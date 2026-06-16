import type { FastifyInstance } from 'fastify';
import { pool } from '../../db/pool.js';
import { redis, redisEnabled } from '../../queue/queues.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'fail' | 'disabled'> = { db: 'fail', redis: redisEnabled ? 'fail' : 'disabled' };
    let dbLatencyMs = 0;
    let redisLatencyMs = 0;

    const t0 = Date.now();
    try { await pool.query('SELECT 1'); checks.db = 'ok'; dbLatencyMs = Date.now() - t0; } catch { /* fail */ }

    if (redisEnabled) {
      const t1 = Date.now();
      try { await redis.ping(); checks.redis = 'ok'; redisLatencyMs = Date.now() - t1; } catch { /* fail */ }
    }

    // Healthy when DB is up. Redis is optional (disabled is not a failure).
    const healthy = checks.db === 'ok' && checks.redis !== 'fail';
    return reply.code(healthy ? 200 : 503).send({
      ok: healthy,
      service: 'trump-trading-backend',
      status: healthy ? 'ok' : 'degraded',
      checks,
      latency: { db: dbLatencyMs, redis: redisLatencyMs },
      time: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      node: process.version,
    });
  });
}
