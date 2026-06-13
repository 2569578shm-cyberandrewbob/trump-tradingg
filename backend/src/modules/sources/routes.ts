import type { FastifyInstance } from 'fastify';
import { query } from '../../db/pool.js';
import { requireAuth } from '../../lib/authPlugin.js';
import { adapterByKey } from '../../ingestion/adapters/index.js';

/**
 * Source status dashboard. Returns, per source: enabled/disabled, reliability,
 * last poll/success, last error + HTTP status, items fetched, new inserted,
 * average latency, and whether the adapter requires an API key.
 */
export async function sourceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/sources', { preHandler: requireAuth }, async () => {
    const rows = await query(
      `SELECT s.id, s.key, s.name, s.type, s.url, s.enabled,
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
              ROUND(COALESCE(h.avg_latency_ms, 0))::int AS "avgLatencyMs"
       FROM sources s
       LEFT JOIN source_reliability sr ON sr.source_id = s.id
       LEFT JOIN source_health h ON h.source_id = s.id
       ORDER BY s.enabled DESC, sr.reliability_score DESC NULLS LAST, s.key`,
    );
    const sources = rows.map((r) => {
      const requiresKey = adapterByKey.get(r.key as string)?.requiresKey ?? false;
      const hasAdapter = adapterByKey.has(r.key as string);
      let status: string;
      if (!r.enabled || requiresKey) status = 'unavailable';
      else if (!hasAdapter) status = 'unavailable';
      else if (r.lastHttpStatus === 429) status = 'rate_limited';
      else if (!r.lastPollAt) status = 'pending';
      else if (r.lastError && !r.lastSuccessAt) status = 'failed';
      else if (r.lastSuccessAt && Number(r.lastItemCount) > 0) status = 'connected';
      else if (r.lastSuccessAt) status = 'no_items';
      else status = 'failed';
      return { ...r, requiresKey, hasAdapter, status };
    });
    return { sources };
  });
}
