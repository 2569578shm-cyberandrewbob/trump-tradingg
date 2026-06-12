import { query, queryOne } from '../db/pool.js';
import { analyzeQueue, redis } from '../queue/queues.js';
import { adapterByKey } from './adapters/index.js';
import { checkDuplicate } from './dedupe.js';
import { env } from '../config/env.js';

/**
 * Ingestion worker. Every tick it loads ENABLED sources from the DB, and for
 * each source whose poll interval has elapsed, fetches new statements,
 * dedupes, stores, and enqueues analysis jobs.
 */

interface SourceRow {
  id: string;
  key: string;
  poll_seconds: number;
  reliability_score: number;
}

const lastPolled = new Map<string, number>();
const lastSeen = new Map<string, Date>();

async function pollSource(src: SourceRow): Promise<void> {
  const adapter = adapterByKey.get(src.key);
  if (!adapter) return;

  const since = lastSeen.get(src.key) ?? new Date(Date.now() - 30 * 60 * 1000);
  const statements = await adapter.fetchLatest(since);
  let newest = since;

  for (const stmt of statements) {
    if (stmt.statedAt > newest) newest = stmt.statedAt;
    if (!stmt.content.trim()) continue;

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
      await analyzeQueue.add('analyze', { rawStatementId: row.id }, { removeOnComplete: 1000, removeOnFail: 1000 });
      await query(
        `UPDATE source_reliability SET total_statements = total_statements + 1, updated_at = now() WHERE source_id = $1`,
        [src.id],
      );
    }
  }
  lastSeen.set(src.key, newest);
}

async function tick(): Promise<void> {
  const sources = await query<SourceRow>(
    `SELECT s.id, s.key, s.poll_seconds, COALESCE(sr.reliability_score, 50) AS reliability_score
     FROM sources s LEFT JOIN source_reliability sr ON sr.source_id = s.id
     WHERE s.enabled = TRUE`,
  );
  const now = Date.now();
  for (const src of sources) {
    const last = lastPolled.get(src.key) ?? 0;
    if (now - last < src.poll_seconds * 1000) continue;
    lastPolled.set(src.key, now);
    try {
      await pollSource(src);
    } catch (err) {
      console.error(`ingest ${src.key} failed:`, (err as Error).message);
    }
  }
}

console.log('ingestion worker started');
setInterval(() => void tick(), Math.min(env.INGEST_POLL_SECONDS_DEFAULT, 15) * 1000);
void tick();

process.on('SIGTERM', async () => {
  await redis.quit();
  process.exit(0);
});
