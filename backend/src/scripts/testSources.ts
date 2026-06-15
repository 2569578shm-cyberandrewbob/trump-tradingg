/**
 * Source test harness — `npm run test:sources`.
 *
 * Polls every enabled source once (server-side, no CORS proxy), inserting any
 * new real items, and prints a strict PASS/FAIL report per source with the HTTP
 * status, items fetched/inserted, a real sample title, and the exact failure
 * reason. One source failing never aborts the run.
 */
import { pool, query, queryOne } from '../db/pool.js';
import { redis } from '../queue/queues.js';
import { loadEnabledSources, pollSource } from '../ingestion/poll.js';
import { adapterByKey } from '../ingestion/adapters/index.js';

/** Map an HTTP status / error string to a precise, human reason. */
function reasonFor(ok: boolean, httpStatus: number | null, error: string | undefined, requiresKey: boolean, fetched: number): string {
  if (requiresKey) return 'REQUIRES API KEY';
  if (ok && fetched === 0) return 'connected — no new items this poll';
  if (ok) return 'OK';
  if (httpStatus === 401 || httpStatus === 403) return `HTTP ${httpStatus} — blocked / forbidden (Cloudflare or auth)`;
  if (httpStatus === 404) return 'HTTP 404 — feed not found (wrong/retired URL)';
  if (httpStatus === 422) return 'HTTP 422 — upstream could not process the request';
  if (httpStatus === 429) return 'HTTP 429 — rate limited';
  if (httpStatus === 503 || httpStatus === 502) return `HTTP ${httpStatus} — source temporarily unavailable`;
  if (httpStatus) return `HTTP ${httpStatus}`;
  if (/timeout|aborted/i.test(error ?? '')) return 'network timeout';
  if (/ENOTFOUND|EAI_AGAIN|fetch failed|ECONNREFUSED/i.test(error ?? '')) return 'network / DNS failure';
  return error ? error.slice(0, 100) : 'unknown error';
}

async function main(): Promise<void> {
  const sources = await loadEnabledSources();
  // eslint-disable-next-line no-console
  console.log(`\nSOURCE TEST REPORT  (${new Date().toISOString()})  — ${sources.length} enabled sources\n${'='.repeat(64)}`);

  let pass = 0;
  let fail = 0;
  let noItems = 0;

  for (const src of sources) {
    const adapter = adapterByKey.get(src.key);
    const requiresKey = adapter?.requiresKey ?? false;
    let result;
    try {
      result = await pollSource(src, { enqueue: false });
    } catch (err) {
      result = { key: src.key, ok: false, httpStatus: null, fetched: 0, inserted: 0, latencyMs: 0, insertedIds: [] as string[], error: (err as Error).message };
    }

    const reason = reasonFor(result.ok, result.httpStatus, result.error, requiresKey, result.fetched);
    const verdict = requiresKey ? 'REQUIRES KEY' : result.ok ? 'PASS' : 'FAIL';
    if (verdict === 'PASS') { result.fetched > 0 ? pass++ : noItems++; }
    else if (verdict === 'FAIL') fail++;

    // Pull a real sample title for proof.
    let sample = '';
    const row = await queryOne<{ content: string }>(
      `SELECT left(content, 90) AS content FROM raw_statements
       WHERE source_id = $1 ORDER BY stated_at DESC NULLS LAST, detected_at DESC LIMIT 1`,
      [src.id],
    ).catch(() => null);
    if (row) sample = row.content.replace(/\s+/g, ' ');

    // eslint-disable-next-line no-console
    console.log(
      `\n${src.key}: ${verdict}\n` +
      `  HTTP: ${result.httpStatus ?? '-'}   Fetched: ${result.fetched}   Inserted: ${result.inserted}   Latency: ${result.latencyMs}ms\n` +
      `  Reason: ${reason}` +
      (sample ? `\n  Sample: ${sample}` : ''),
    );
  }

  // eslint-disable-next-line no-console
  console.log(`\n${'='.repeat(64)}\nSUMMARY: ${pass} PASS (with items) · ${noItems} connected-no-new · ${fail} FAIL · ${sources.length} total`);

  // DB proof
  const counts = await queryOne<Record<string, string>>(
    `SELECT (SELECT count(*) FROM raw_statements) AS raw_total,
            (SELECT count(*) FROM processed_alerts) AS alerts_total,
            (SELECT count(*) FROM notification_logs) AS notif_total`,
  );
  // eslint-disable-next-line no-console
  console.log(`DB: raw_statements=${counts?.raw_total} processed_alerts=${counts?.alerts_total} notification_logs=${counts?.notif_total}`);

  await redis.quit().catch(() => {});
  await pool.end().catch(() => {});
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('test:sources FAILED to run:', err);
  await redis.quit().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
