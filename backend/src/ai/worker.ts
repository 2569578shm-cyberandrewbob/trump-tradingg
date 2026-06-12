import { Worker } from 'bullmq';
import { redis, notifyQueue } from '../queue/queues.js';
import { queryOne } from '../db/pool.js';
import { analyzeStatement, persistAlert } from './analyzer.js';

/** Analysis worker: consumes raw statement ids, runs AI, persists alerts, enqueues notifications. */
const worker = new Worker<{ rawStatementId: string }, void, string>(
  'analyze',
  async (job) => {
    const { rawStatementId } = job.data;
    const stmt = await queryOne<{ content: string; stated_at: Date; source_name: string }>(
      `SELECT rs.content, rs.stated_at, s.name AS source_name
       FROM raw_statements rs JOIN sources s ON s.id = rs.source_id
       WHERE rs.id = $1 AND rs.status = 'pending'`,
      [rawStatementId],
    );
    if (!stmt) return;

    const { analysis, engine } = await analyzeStatement(rawStatementId, stmt.content, stmt.source_name, stmt.stated_at);
    const alertId = await persistAlert(rawStatementId, analysis, engine);
    if (alertId && analysis.isMarketRelevant) {
      await notifyQueue.add('notify', { alertId }, { removeOnComplete: 1000, removeOnFail: 1000 });
    }
  },
  { connection: redis, concurrency: 4 },
);

worker.on('failed', (job, err) => console.error(`analyze job ${job?.id} failed:`, err.message));
console.log('analysis worker started');
