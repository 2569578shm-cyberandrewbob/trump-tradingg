import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { env } from './config/env.js';
import { AppError } from './lib/errors.js';
import { redis, redisEnabled } from './queue/queues.js';
import { authRoutes } from './modules/auth/routes.js';
import { alertRoutes } from './modules/alerts/routes.js';
import { watchlistRoutes } from './modules/watchlist/routes.js';
import { prefsRoutes } from './modules/prefs/routes.js';
import { sourceRoutes } from './modules/sources/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { webDataRoutes } from './modules/webdata/routes.js';

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '../web');

export async function buildApp() {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  // CSP disabled: this server also serves a single-file dashboard with inline
  // scripts, inline event handlers, and same-origin http fetches. The default
  // CSP (script-src-attr 'none' + upgrade-insecure-requests) breaks all of
  // those on http://localhost. Other Helmet headers stay on.
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    // Use Redis when configured; otherwise fall back to in-memory (free tier).
    ...(redisEnabled ? { redis } : {}),
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

  // Base routes (each module owns its own paths — register exactly once).
  // alertRoutes already declares /feed, /alerts, /alerts/dashboard,
  // /market-impact and /assets/affected, so there is no separate market module.
  await app.register(authRoutes);
  await app.register(alertRoutes);
  await app.register(watchlistRoutes);
  await app.register(prefsRoutes);
  await app.register(sourceRoutes);
  await app.register(adminRoutes);
  await app.register(healthRoutes);
  await app.register(webDataRoutes); // /dashboard, /raw-statements, /settings/status

  // /api/ prefixed versions for backward/forward compatibility.
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(alertRoutes, { prefix: '/api' });
  await app.register(watchlistRoutes, { prefix: '/api' });
  await app.register(prefsRoutes, { prefix: '/api' });
  await app.register(sourceRoutes, { prefix: '/api' });
  await app.register(adminRoutes, { prefix: '/api' });
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(webDataRoutes, { prefix: '/api' });

  const AVAILABLE_ENDPOINTS = [
    '/health', '/dashboard', '/feed', '/alerts', '/alerts/:id', '/alerts/high-impact',
    '/alerts/by-ticker/:ticker', '/alerts/by-category/:category',
    '/sources', '/sources/status', '/sources/:id/retry', '/raw-statements', '/raw-statements/:id',
    '/market-impact', '/assets/affected', '/settings/status', '/legal/disclaimer',
    '/api/* (prefixed versions of all above)',
  ];

  // Serve the web dashboard SPA at the root (same-origin → no CORS, no proxies).
  const serveSpa = (_req: unknown, reply: { type: (t: string) => { send: (b: string) => void } }) => {
    try {
      reply.type('text/html').send(readFileSync(join(WEB_DIR, 'index.html'), 'utf8'));
    } catch {
      reply.type('text/html').send('<h1>Trump Trading</h1><p>Web dashboard not built. See backend/web/index.html.</p>');
    }
  };
  app.get('/', serveSpa);
  app.get('/app', serveSpa);
  // Machine-readable route index.
  app.get('/api', async () => ({ ok: true, service: 'trump-trading-api', available_endpoints: AVAILABLE_ENDPOINTS }));

  // JSON 404 (instead of plain "Not Found") so the app can show a useful error.
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      ok: false, error: 'Route not found', path: req.url, method: req.method,
      available_endpoints: AVAILABLE_ENDPOINTS,
    });
  });

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
