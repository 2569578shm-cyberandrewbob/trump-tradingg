import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { requireAuth } from '../../lib/authPlugin.js';
import { adapterByKey } from '../../ingestion/adapters/index.js';
import { pollSource, type SourceRow } from '../../ingestion/poll.js';
import { notFound } from '../../lib/errors.js';

const SOURCE_SELECT = `
  SELECT s.id, s.key, s.name, s.type, s.url, s.enabled,
         s.source_group AS "group", s.source_kind AS "kind",
         COALESCE(sr.reliability_score, 50) AS "reliabilityScore",
         COALESCE(sr.total_statements, 0)   AS "totalStatements",
         h.last_poll_at        AS "lastPollAt",
         h.last_success_at     AS "lastSuccessAt",
         h.last_error          AS "lastError",
         h.last_http_status    AS "lastHttpStatus",
         h.last_item_count     AS "lastItemCount",
         h.last_new_count      AS "lastNewCount",
         h.total_items_fetched AS "totalItemsFetched",
         h.total_new_inserted  AS "totalNewInserted",
         h.poll_count          AS "pollCount",
         h.error_count         AS "errorCount",
         ROUND(COALESCE(h.avg_latency_ms, 0))::int AS "avgLatencyMs",
         (SELECT rs.source_url FROM raw_statements rs
            WHERE rs.source_id = s.id AND rs.source_url IS NOT NULL
            ORDER BY rs.detected_at DESC NULLS LAST LIMIT 1) AS "sampleUrl"
  FROM sources s
  LEFT JOIN source_reliability sr ON sr.source_id = s.id
  LEFT JOIN source_health h ON h.source_id = s.id`;

/** Derive a UI status + precise human reason from the health row. */
function classify(r: Record<string, unknown>): { status: string; reason: string } {
  const requiresKey = adapterByKey.get(r.key as string)?.requiresKey ?? false;
  const hasAdapter = adapterByKey.has(r.key as string);
  const http = r.lastHttpStatus as number | null;
  const err = (r.lastError as string | null) ?? '';
  const items = Number(r.lastItemCount ?? 0);

  if (requiresKey) return { status: 'requires_key', reason: 'Requires API key — not enabled' };
  if (!r.enabled) return { status: 'unavailable', reason: 'Disabled' };
  if (!hasAdapter) return { status: 'unavailable', reason: 'No adapter registered (unsupported)' };
  if (!r.lastPollAt) return { status: 'pending', reason: 'Not polled yet' };

  if (r.lastSuccessAt && items > 0) return { status: 'connected', reason: 'OK' };
  if (r.lastSuccessAt && !err) return { status: 'no_items', reason: 'Connected — no new items this poll' };

  // failed paths
  if (http === 401 || http === 403) return { status: 'blocked', reason: `HTTP ${http} — blocked / forbidden (Cloudflare or auth)` };
  if (http === 404) return { status: 'failed', reason: 'HTTP 404 — feed not found (wrong/retired URL)' };
  if (http === 422) return { status: 'failed', reason: 'HTTP 422 — upstream could not process the request' };
  if (http === 429) return { status: 'rate_limited', reason: 'HTTP 429 — rate limited' };
  if (http === 502 || http === 503) return { status: 'degraded', reason: `HTTP ${http} — source temporarily unavailable` };
  if (/timeout|aborted/i.test(err)) return { status: 'degraded', reason: 'Network timeout' };
  if (/ENOTFOUND|EAI_AGAIN|fetch failed|ECONNREFUSED/i.test(err)) return { status: 'failed', reason: 'Network / DNS failure' };
  if (http) return { status: 'failed', reason: `HTTP ${http}` };
  return { status: r.lastSuccessAt ? 'no_items' : 'failed', reason: err ? err.slice(0, 120) : 'OK' };
}

function decorate(r: Record<string, unknown>) {
  const requiresKey = adapterByKey.get(r.key as string)?.requiresKey ?? false;
  const hasAdapter = adapterByKey.has(r.key as string);
  const { status, reason } = classify(r);
  return { ...r, requiresKey, hasAdapter, status, reason };
}

export async function sourceRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  const list = async () => {
    const rows = await query(`${SOURCE_SELECT} ORDER BY s.enabled DESC, sr.reliability_score DESC NULLS LAST, s.key`);
    return { sources: rows.map(decorate) };
  };

  app.get('/sources', list);
  app.get('/sources/status', list); // explicit alias

  /** Retry a single source now and return its full updated status + fetch result. */
  app.post('/sources/:id/retry', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const src = await queryOne<SourceRow>(
      `SELECT s.id, s.key, s.poll_seconds, COALESCE(sr.reliability_score, 50) AS reliability_score
       FROM sources s LEFT JOIN source_reliability sr ON sr.source_id = s.id WHERE s.id = $1`,
      [id],
    );
    if (!src) throw notFound('Source not found');

    const result = await pollSource(src, { enqueue: false });
    const row = await queryOne(`${SOURCE_SELECT} WHERE s.id = $1`, [id]);
    return {
      result: {
        success: result.ok,
        sourceId: id,
        itemsFetched: result.fetched,
        itemsInserted: result.inserted,
        duplicatesSkipped: Math.max(0, result.fetched - result.inserted),
        httpStatus: result.httpStatus,
        lastError: result.error ?? null,
        latencyMs: result.latencyMs,
      },
      source: row ? decorate(row) : null,
    };
  });
}
