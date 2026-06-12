import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { AppError } from './lib/errors.js';
import { redis } from './queue/queues.js';
import { authRoutes } from './modules/auth/routes.js';
import { alertRoutes } from './modules/alerts/routes.js';
import { watchlistRoutes } from './modules/watchlist/routes.js';
import { prefsRoutes } from './modules/prefs/routes.js';
import { sourceRoutes } from './modules/sources/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { healthRoutes } from './modules/health/routes.js';

export async function buildApp() {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  await app.register(helmet);
  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (req) => (req.headers.authorization ?? req.ip),
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', details: err.flatten().fieldErrors });
    }
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: err.code, message: err.message });
    }
    const status = (err as { statusCode?: unknown }).statusCode;
    if (typeof status === 'number' && status < 500) {
      return reply.code(status).send({ error: 'REQUEST_ERROR', message: (err as Error).message });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
  });

  await app.register(authRoutes);
  await app.register(alertRoutes);
  await app.register(watchlistRoutes);
  await app.register(prefsRoutes);
  await app.register(sourceRoutes);
  await app.register(adminRoutes);
  await app.register(healthRoutes);

  // Legal: served in-app on the Disclaimer screen as well.
  app.get('/legal/disclaimer', async () => ({
    disclaimer:
      'Trump Trading provides informational alerts about public political statements. ' +
      'It does NOT provide investment, financial, legal, or tax advice. AI-generated analysis may be ' +
      'inaccurate, incomplete, or delayed. Always verify statements at the original source and consult ' +
      'a licensed financial advisor before making trading decisions. You are solely responsible for your trades.',
    privacyPolicy: 'Placeholder: we store your email, hashed password, watchlist, notification preferences, and device push tokens. We do not sell personal data. Full policy to be published before production release.',
  }));

  return app;
}
