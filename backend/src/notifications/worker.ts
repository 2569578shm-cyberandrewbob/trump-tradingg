import { Worker } from 'bullmq';
import { redis } from '../queue/queues.js';
import { dispatchAlert } from './dispatcher.js';

const worker = new Worker<{ alertId: string }, void, string>(
  'notify',
  async (job) => dispatchAlert(job.data.alertId),
  { connection: redis, concurrency: 2 },
);

worker.on('failed', (job, err) => console.error(`notify job ${job?.id} failed:`, err.message));
console.log('notification worker started');
