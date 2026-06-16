import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env, redisEnabled } from '../config/env.js';

export { redisEnabled };

/**
 * Redis is OPTIONAL. With no REDIS_URL the app runs Redis-free:
 *  - dedupe falls back to DB-only (the stub's sismember→0 means "not cached",
 *    so the exact-hash + pg_trgm DB layers still dedupe correctly)
 *  - rate limiting uses in-memory (see app.ts)
 *  - no BullMQ workers (the in-process scheduler analyzes inline)
 * This keeps free tiers (e.g. Neon-only, no Upstash) well within quotas.
 */
const redisStub = {
  async ping(): Promise<string> { throw new Error('redis disabled'); },
  async sismember(): Promise<number> { return 0; },
  async sadd(): Promise<number> { return 0; },
  async expire(): Promise<number> { return 0; },
  async quit(): Promise<'OK'> { return 'OK'; },
  on(): unknown { return redisStub; },
  status: 'disabled',
} as unknown as Redis;

export const redis: Redis = redisEnabled
  ? new Redis(env.REDIS_URL as string, { maxRetriesPerRequest: null, lazyConnect: true })
  : redisStub;

const stubQueue = { add: async () => undefined } as unknown as Queue<{ rawStatementId: string }, void, string>;

export const analyzeQueue: Queue<{ rawStatementId: string }, void, string> = redisEnabled
  ? new Queue('analyze', { connection: redis })
  : stubQueue;

export const notifyQueue: Queue<{ alertId: string }, void, string> = redisEnabled
  ? new Queue('notify', { connection: redis })
  : (stubQueue as unknown as Queue<{ alertId: string }, void, string>);
