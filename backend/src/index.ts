import { buildApp } from './app.js';
import { env } from './config/env.js';
import { startScheduler } from './scheduler.js';

const app = await buildApp();

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Trump Trading API listening on :${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Free single-instance hosting has no background workers — run ingestion +
// analysis in-process on a timer when RUN_SCHEDULER is set.
if (process.env.RUN_SCHEDULER === 'true') {
  const seconds = Number(process.env.SCHEDULER_INTERVAL_SECONDS) || 90;
  startScheduler(seconds * 1000);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
