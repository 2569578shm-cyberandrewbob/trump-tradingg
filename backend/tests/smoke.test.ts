/**
 * Backend smoke tests — verify the core endpoints the Android app depends on:
 *   GET /health, GET /sources, GET /feed, GET /alerts
 * Require a running PostgreSQL (migrated + seeded) and Redis.
 * Skipped automatically unless RUN_API_TESTS=1.
 *   RUN_API_TESTS=1 DATABASE_URL=... REDIS_URL=... npm test smoke
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const enabled = process.env.RUN_API_TESTS === '1';

describe.skipIf(!enabled)('Smoke: core endpoints', async () => {
  const { buildApp } = await import('../src/app.js');
  const { pool } = await import('../src/db/pool.js');
  let app: Awaited<ReturnType<typeof buildApp>>;
  let token = '';
  const email = `smoke-${Date.now()}@example.com`;

  beforeAll(async () => {
    app = await buildApp();
    await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'Sup3rSecret!', displayName: 'Smoke' } });
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'Sup3rSecret!' } });
    token = login.json().accessToken;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [email]);
    await app.close();
  });

  const auth = () => ({ authorization: `Bearer ${token}` });

  it('GET /health returns ok with db + redis up', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.checks.db).toBe('ok');
    expect(body.checks.redis).toBe('ok');
  });

  it('GET /sources lists at least 10 sources with group + kind + status', async () => {
    const res = await app.inject({ method: 'GET', url: '/sources', headers: auth() });
    expect(res.statusCode).toBe(200);
    const { sources } = res.json();
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThanOrEqual(10);
    for (const s of sources) {
      expect(s).toHaveProperty('group');
      expect(s).toHaveProperty('kind');
      expect(s).toHaveProperty('status');
    }
    // Should span multiple distinct groups.
    const groups = new Set(sources.map((s: { group: string }) => s.group));
    expect(groups.size).toBeGreaterThanOrEqual(3);
  });

  it('GET /feed returns an items array (newest first)', async () => {
    const res = await app.inject({ method: 'GET', url: '/feed', headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().items)).toBe(true);
  });

  it('GET /alerts returns an alerts array', async () => {
    const res = await app.inject({ method: 'GET', url: '/alerts', headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().alerts)).toBe(true);
  });

  it('rejects unauthenticated /feed and /alerts with 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/feed' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/alerts' })).statusCode).toBe(401);
  });
});
