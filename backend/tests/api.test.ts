/**
 * API integration tests. Require a running PostgreSQL (migrated) and Redis.
 * Skipped automatically unless RUN_API_TESTS=1.
 *   RUN_API_TESTS=1 DATABASE_URL=... REDIS_URL=... npm test
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const enabled = process.env.RUN_API_TESTS === '1';

describe.skipIf(!enabled)('REST API', async () => {
  const { buildApp } = await import('../src/app.js');
  const { pool } = await import('../src/db/pool.js');
  let app: Awaited<ReturnType<typeof buildApp>>;
  let token = '';
  const email = `test-${Date.now()}@example.com`;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [email]);
    await app.close();
  });

  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().checks.db).toBe('ok');
  });

  it('POST /auth/register creates a user', async () => {
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email, password: 'Sup3rSecret!', displayName: 'Tester' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().accessToken).toBeTruthy();
  });

  it('rejects weak passwords with 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { email: 'x@y.com', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('VALIDATION_ERROR');
  });

  it('POST /auth/login returns tokens', async () => {
    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email, password: 'Sup3rSecret!' },
    });
    expect(res.statusCode).toBe(200);
    token = res.json().accessToken;
  });

  it('rejects unauthenticated /alerts with 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/alerts' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /alerts returns a list', async () => {
    const res = await app.inject({ method: 'GET', url: '/alerts', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().alerts)).toBe(true);
  });

  it('watchlist add / list / remove round-trip', async () => {
    const h = { authorization: `Bearer ${token}` };
    expect((await app.inject({ method: 'POST', url: '/watchlist', headers: h, payload: { ticker: 'nvda' } })).statusCode).toBe(201);
    const list = await app.inject({ method: 'GET', url: '/watchlist', headers: h });
    expect(list.json().tickers).toContain('NVDA');
    expect((await app.inject({ method: 'DELETE', url: '/watchlist/NVDA', headers: h })).statusCode).toBe(200);
  });

  it('rejects invalid ticker input', async () => {
    const res = await app.inject({
      method: 'POST', url: '/watchlist',
      headers: { authorization: `Bearer ${token}` },
      payload: { ticker: 'DROP TABLE;' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PUT /notification-preferences persists settings', async () => {
    const h = { authorization: `Bearer ${token}` };
    const res = await app.inject({
      method: 'PUT', url: '/notification-preferences', headers: h,
      payload: { minRiskLevel: 'Critical', quietHoursStart: 23, quietHoursEnd: 7, timezone: 'America/New_York' },
    });
    expect(res.statusCode).toBe(200);
    const get = await app.inject({ method: 'GET', url: '/notification-preferences', headers: h });
    expect(get.json().minRiskLevel).toBe('Critical');
  });

  it('blocks non-admin from admin endpoints', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/alerts', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
  });
});
