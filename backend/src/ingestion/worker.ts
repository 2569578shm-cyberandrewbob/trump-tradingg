import { env } from '../config/env.js';
import { redis } from '../queue/queues.js';
import { pollDue } from './poll.js';

/**
 * Long-running ingestion worker. Each tick polls enabled sources whose poll
 * interval has elapsed, dedupes, stores raw statements, and enqueues analysis
 * jobs. Per-poll telemetry is written to source_health and logged to stdout.
 */
const TICK_SECONDS = Math.min(env.INGEST_POLL_SECONDS_DEFAULT, 15);

async function tick(): Promise<void> {
  try {
    await pollDue();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('ingestion tick failed:', (err as Error).message);
  }
}

// eslint-disable-next-line no-console
console.log(`ingestion worker started (tick every ${TICK_SECONDS}s)`);
setInterval(() => void tick(), TICK_SECONDS * 1000);
void tick();

process.on('SIGTERM', async () => {
  await redis.quit();
  process.exit(0);
});
