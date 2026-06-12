import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });

export const analyzeQueue = new Queue<{ rawStatementId: string }, void, string>('analyze', { connection: redis });
export const notifyQueue = new Queue<{ alertId: string }, void, string>('notify', { connection: redis });
