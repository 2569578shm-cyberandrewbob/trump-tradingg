/**
 * In-process scheduler for free single-instance hosting (e.g. Render free tier,
 * which has no background workers). Runs the full ingestion + analysis pipeline
 * inline on a timer instead of via separate BullMQ worker processes:
 *
 *   pollDue (fetch new statements, respecting per-source intervals)
 *     -> processPending (analyze raw_statements -> processed_alerts)
 *
 * Notification dispatch is intentionally skipped here (it needs Firebase and is
 * optional); the app reads alerts straight from the database.
 *
 * Enabled by setting RUN_SCHEDULER=true (the web service does this on Render).
 */
import { pollDue } from './ingestion/poll.js';
import { processPending } from './ai/processPending.js';

let running = false;

async function tick(): Promise<void> {
  if (running) return; // never overlap ticks
  running = true;
  const started = Date.now();
  try {
    const polls = await pollDue({ enqueue: false });
    const inserted = polls.reduce((n, p) => n + p.inserted, 0);
    let processed = 0;
    let alerts = 0;
    if (inserted > 0) {
      const r = await processPending();
      processed = r.processed;
      alerts = r.alertIds.length;
    }
    const ms = Date.now() - started;
    // eslint-disable-next-line no-console
    console.log(`[scheduler ${new Date().toISOString()}] polled=${polls.length} new=${inserted} analyzed=${processed} alerts=${alerts} (${ms}ms)`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[scheduler] tick failed:', (err as Error).message);
  } finally {
    running = false;
  }
}

export function startScheduler(intervalMs = 60_000): void {
  // eslint-disable-next-line no-console
  console.log(`[scheduler] starting — every ${Math.round(intervalMs / 1000)}s`);
  // Kick off one tick shortly after boot so a freshly-woken instance fills data,
  // then on a fixed interval.
  setTimeout(() => { void tick(); }, 4_000);
  setInterval(() => { void tick(); }, intervalMs);
}
