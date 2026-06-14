import { query, queryOne } from '../db/pool.js';
import { analyzeQueue } from '../queue/queues.js';
import { adapterByKey } from './adapters/index.js';
import { FetchError } from './adapters/types.js';
import { checkDuplicate } from './dedupe.js';

export interface SourceRow {
  id: string;
  key: string;
  poll_seconds: number;
  reliability_score: number;
}

export interface PollResult {
  key: string;
  ok: boolean;
  httpStatus: number | null;
  fetched: number;
  inserted: number;
  latencyMs: number;
  insertedIds: string[];
  error?: string;
  note?: string;
}

const lastSeen = new Map<string, Date>();
const lastPolled = new Map<string, number>();

/** Poll one source: fetch → dedupe (post-id + text hash) → insert → record health. */
export async function pollSource(src: SourceRow, opts: { enqueue?: boolean } = {}): Promise<PollResult> {
  const enqueue = opts.enqueue ?? true;
  const adapter = adapterByKey.get(src.key);
  const started = Date.now();
  const since = lastSeen.get(src.key) ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (!adapter) {
    return { key: src.key, ok: false, httpStatus: null, fetched: 0, inserted: 0, latencyMs: 0, insertedIds: [], error: 'no adapter registered' };
  }

  try {
    const outcome = await adapter.fetchLatest(since);
    const latencyMs = Date.now() - started;
    const insertedIds: string[] = [];
    let newest = since;

    for (const stmt of outcome.items) {
      if (stmt.statedAt > newest) newest = stmt.statedAt;
      if (!stmt.content.trim()) continue;

      // Dedupe layer 1: same post id from this source already stored.
      if (stmt.externalId) {
        const seen = await queryOne<{ id: string }>(
          `SELECT id FROM raw_statements WHERE source_id = $1 AND external_id = $2`,
          [src.id, stmt.externalId],
        );
        if (seen) continue;
      }
      // Dedupe layer 2/3: exact + near-duplicate text (cross-source confirmation).
      const dedupe = await checkDuplicate(stmt.content, src.id);
      if (dedupe.kind !== 'new') continue;

      const row = await queryOne<{ id: string }>(
        `INSERT INTO raw_statements (source_id, external_id, content, content_hash, source_url, stated_at, confidence_score, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (content_hash) DO NOTHING
         RETURNING id`,
        [src.id, stmt.externalId ?? null, stmt.content, dedupe.hash, stmt.sourceUrl, stmt.statedAt,
         src.reliability_score, JSON.stringify(stmt.metadata ?? {})],
      );
      if (row) {
        insertedIds.push(row.id);
        if (enqueue) {
          await analyzeQueue.add('analyze', { rawStatementId: row.id }, { removeOnComplete: 1000, removeOnFail: 1000 });
        }
      }
    }

    lastSeen.set(src.key, newest);
    await recordHealth(src.id, { ok: true, httpStatus: outcome.httpStatus, fetched: outcome.fetchedCount, inserted: insertedIds.length, latencyMs });
    const result: PollResult = { key: src.key, ok: true, httpStatus: outcome.httpStatus, fetched: outcome.fetchedCount, inserted: insertedIds.length, latencyMs, insertedIds, note: outcome.note };
    logPoll(result);
    return result;
  } catch (err) {
    const latencyMs = Date.now() - started;
    const httpStatus = err instanceof FetchError ? err.httpStatus : null;
    const message = err instanceof FetchError
      ? `${err.message}${err.body ? ` :: ${err.body.replace(/\s+/g, ' ').slice(0, 200)}` : ''}`
      : (err as Error).message;
    await recordHealth(src.id, { ok: false, httpStatus, fetched: 0, inserted: 0, latencyMs, error: message });
    const result: PollResult = { key: src.key, ok: false, httpStatus, fetched: 0, inserted: 0, latencyMs, insertedIds: [], error: message };
    logPoll(result);
    return result;
  }
}

async function recordHealth(
  sourceId: string,
  d: { ok: boolean; httpStatus: number | null; fetched: number; inserted: number; latencyMs: number; error?: string },
): Promise<void> {
  // Running average latency computed in SQL from the prior poll_count.
  await query(
    `INSERT INTO source_health AS h
       (source_id, last_poll_at, last_success_at, last_error, last_http_status,
        last_item_count, last_new_count, total_items_fetched, total_new_inserted,
        poll_count, error_count, avg_latency_ms, updated_at)
     VALUES ($1, now(), $2, $3, $4::int, $5::bigint, $6::bigint, $5::bigint, $6::bigint, 1, $7::bigint, $8::double precision, now())
     ON CONFLICT (source_id) DO UPDATE SET
       last_poll_at = now(),
       last_success_at = CASE WHEN $9 THEN now() ELSE h.last_success_at END,
       last_error = CASE WHEN $9 THEN h.last_error ELSE $3 END,
       last_http_status = $4::int,
       last_item_count = $5::bigint,
       last_new_count = $6::bigint,
       total_items_fetched = h.total_items_fetched + $5::bigint,
       total_new_inserted = h.total_new_inserted + $6::bigint,
       poll_count = h.poll_count + 1,
       error_count = h.error_count + $7::bigint,
       avg_latency_ms = (h.avg_latency_ms * h.poll_count + $8::double precision) / (h.poll_count + 1),
       updated_at = now()`,
    [
      sourceId,
      d.ok ? new Date() : null,
      d.error ?? null,
      d.httpStatus,
      d.fetched,
      d.inserted,
      d.ok ? 0 : 1,
      d.latencyMs,
      d.ok,
    ],
  );
}

function logPoll(r: PollResult): void {
  const stamp = new Date().toISOString();
  if (r.ok) {
    // eslint-disable-next-line no-console
    console.log(`[poll ${stamp}] ${r.key} status=${r.httpStatus ?? '-'} fetched=${r.fetched} new=${r.inserted} latency=${r.latencyMs}ms${r.note ? ` (${r.note})` : ''}`);
  } else {
    // eslint-disable-next-line no-console
    console.error(`[poll ${stamp}] ${r.key} FAILED status=${r.httpStatus ?? '-'} latency=${r.latencyMs}ms error=${r.error}`);
  }
}

export async function loadEnabledSources(): Promise<SourceRow[]> {
  return query<SourceRow>(
    `SELECT s.id, s.key, s.poll_seconds, COALESCE(sr.reliability_score, 50) AS reliability_score
     FROM sources s LEFT JOIN source_reliability sr ON sr.source_id = s.id
     WHERE s.enabled = TRUE
     ORDER BY s.key`,
  );
}

/** One scheduler tick: poll every enabled source whose interval has elapsed. */
export async function pollDue(opts: { enqueue?: boolean } = {}): Promise<PollResult[]> {
  const sources = await loadEnabledSources();
  const now = Date.now();
  const results: PollResult[] = [];
  for (const src of sources) {
    const last = lastPolled.get(src.key) ?? 0;
    if (now - last < src.poll_seconds * 1000) continue;
    lastPolled.set(src.key, now);
    results.push(await pollSource(src, opts));
  }
  return results;
}

/** Poll every enabled source right now, ignoring intervals (verification / manual refresh). */
export async function pollAllNow(opts: { enqueue?: boolean } = {}): Promise<PollResult[]> {
  const sources = await loadEnabledSources();
  const results: PollResult[] = [];
  for (const src of sources) results.push(await pollSource(src, opts));
  return results;
}
