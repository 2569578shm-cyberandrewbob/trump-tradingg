import type { FastifyInstance } from 'fastify';
import { pool } from '../../db/pool.js';
import { redis } from '../../queue/queues.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = { db: 'fail', redis: 'fail' };
    try { await pool.query('SELECT 1'); checks.db = 'ok'; } catch { /* fail */ }
    try { await redis.ping(); checks.redis = 'ok'; } catch { /* fail */ }
    const healthy = Object.values(checks).every((v) => v === 'ok');
    return reply.code(healthy ? 200 : 503).send({ status: healthy ? 'ok' : 'degraded', checks, time: new Date().toISOString() });
  });
}
