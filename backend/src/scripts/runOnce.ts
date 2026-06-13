/**
 * One-shot end-to-end verification: poll every enabled REAL source once, run
 * the full pipeline inline (dedupe → analysis → alerts → notification dispatch),
 * then print proof from the database. Deterministic (no queue timing).
 *
 *   npm run verify:once
 */
import { pool, query, queryOne } from '../db/pool.js';
import { redis } from '../queue/queues.js';
import { pollAllNow } from '../ingestion/poll.js';
import { processPending } from '../ai/processPending.js';
import { dispatchAlert } from '../notifications/dispatcher.js';

function hr(label: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n=== ${label} ${'='.repeat(Math.max(0, 56 - label.length))}`);
}

async function main(): Promise<void> {
  hr('1. POLLING REAL SOURCES');
  const polls = await pollAllNow({ enqueue: false });
  // eslint-disable-next-line no-console
  console.table(
    polls.map((p) => ({
      source: p.key,
      ok: p.ok,
      http: p.httpStatus ?? '-',
      fetched: p.fetched,
      new: p.inserted,
      latency_ms: p.latencyMs,
      error: p.error ? p.error.slice(0, 60) : '',
    })),
  );

  hr('2. ANALYSIS (pending raw_statements -> processed_alerts)');
  const { alertIds, processed } = await processPending();
  // eslint-disable-next-line no-console
  console.log(`analyzed ${processed} pending statements -> ${alertIds.length} market-relevant alerts`);

  hr('3. NOTIFICATION DISPATCH');
  for (const id of alertIds) await dispatchAlert(id);
  const [{ count: logCount }] = await query<{ count: string }>(`SELECT count(*) FROM notification_logs`);
  // eslint-disable-next-line no-console
  console.log(`notification_logs rows: ${logCount}`);

  hr('4. PROOF — counts');
  const counts = await queryOne<Record<string, string>>(
    `SELECT
       (SELECT count(*) FROM raw_statements)                                   AS raw_total,
       (SELECT count(*) FROM raw_statements rs JOIN sources s ON s.id=rs.source_id WHERE s.key='truth_social') AS raw_truth_social,
       (SELECT count(*) FROM processed_alerts)                                 AS alerts_total,
       (SELECT count(*) FROM processed_alerts WHERE risk_level IN ('High','Critical')) AS alerts_high_impact,
       (SELECT count(*) FROM alert_tickers)                                    AS alert_tickers,
       (SELECT count(*) FROM notification_logs)                                AS notification_logs,
       (SELECT count(*) FROM ai_analysis_logs)                                 AS ai_logs`,
  );
  // eslint-disable-next-line no-console
  console.table(counts);

  hr('5. SAMPLE — newest REAL Truth Social statements');
  const ts = await query<{ stated_at: Date; external_id: string; content: string }>(
    `SELECT rs.stated_at, rs.external_id, left(rs.content, 120) AS content
     FROM raw_statements rs JOIN sources s ON s.id = rs.source_id
     WHERE s.key = 'truth_social'
     ORDER BY rs.stated_at DESC LIMIT 5`,
  );
  ts.forEach((r) => {
    // eslint-disable-next-line no-console
    console.log(`  [${r.stated_at.toISOString()}] id=${r.external_id}\n    ${r.content.replace(/\s+/g, ' ')}`);
  });

  hr('6. SAMPLE — newest alerts');
  const al = await query<{ risk_level: string; categories: string[]; summary: string; source: string }>(
    `SELECT a.risk_level, a.categories, left(a.summary,110) AS summary, s.key AS source
     FROM processed_alerts a JOIN raw_statements rs ON rs.id=a.raw_statement_id JOIN sources s ON s.id=rs.source_id
     ORDER BY a.created_at DESC LIMIT 6`,
  );
  al.forEach((r) => {
    // eslint-disable-next-line no-console
    console.log(`  ${r.risk_level.padEnd(8)} [${r.source}] {${r.categories.join(', ')}}\n    ${r.summary.replace(/\s+/g, ' ')}`);
  });

  await redis.quit();
  await pool.end();
  // eslint-disable-next-line no-console
  console.log('\nverify:once complete');
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('verify:once FAILED:', err);
  await redis.quit().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
