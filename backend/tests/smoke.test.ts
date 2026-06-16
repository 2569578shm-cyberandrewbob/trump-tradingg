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
    // Redis is optional: 'ok' when configured, 'disabled' when running Redis-free.
    expect(['ok', 'disabled']).toContain(body.checks.redis);
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

  it('GET /market-impact returns items with affected_assets', async () => {
    const res = await app.inject({ method: 'GET', url: '/market-impact', headers: auth() });
    expect(res.statusCode).toBe(200);
    const { items } = res.json();
    expect(Array.isArray(items)).toBe(true);
    for (const it of items) expect(it).toHaveProperty('affected_assets');
  });

  it('GET /assets/affected returns aggregated buckets + disclaimer', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/affected', headers: auth() });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b).toHaveProperty('topStocks');
    expect(b).toHaveProperty('topEtfs');
    expect(b).toHaveProperty('topCommodities');
    expect(b).toHaveProperty('topSectors');
    expect(b.disclaimer).toContain('Not financial advice');
  });

  it('/feed items carry market impact + summary', async () => {
    const res = await app.inject({ method: 'GET', url: '/feed?limit=5', headers: auth() });
    const items = res.json().items;
    if (items.length) {
      expect(items[0]).toHaveProperty('affected_assets');
      expect(items[0]).toHaveProperty('market_impact_summary');
    }
  });
});

import { describe as d2, it as it2, expect as e2 } from 'vitest';
import { analyzeMarketImpact } from '../src/market/marketImpact.js';

d2('Market impact keyword mapping', () => {
  it2('war/escalation → defense + energy + gold + airlines + indices', () => {
    const r = analyzeMarketImpact({ text: 'Trump orders military strike on Iran in the Middle East', urgency: 80 });
    const syms = [...r.affected_assets, ...r.affected_etfs].map((a) => a.symbol);
    expect(syms).toContain('LMT'); expect(syms).toContain('XOM');
    expect(syms).toContain('GLD'); expect(syms).toContain('SPY');
    expect(r.affected_assets.some((a) => a.sector === 'Airlines')).toBe(true);
  });
  it2('tariffs → retailers + industrials + semis + China ETFs + steel', () => {
    const r = analyzeMarketImpact({ text: 'Trump announces tariffs on China imports' });
    const syms = [...r.affected_assets, ...r.affected_etfs].map((a) => a.symbol);
    expect(syms).toContain('NVDA'); expect(syms).toContain('WMT');
    expect(syms).toContain('FXI'); expect(syms).toContain('X');
  });
  it2('crypto → BTC, ETH, COIN, MSTR, MARA, RIOT, HOOD, IBIT', () => {
    const r = analyzeMarketImpact({ text: 'Trump comments on Bitcoin and crypto regulation' });
    const syms = [...r.affected_assets, ...r.affected_etfs, ...r.affected_macro_assets.map((m) => ({ symbol: m.asset }))].map((a) => a.symbol);
    ['BTC', 'ETH', 'COIN', 'MSTR', 'MARA', 'RIOT', 'HOOD', 'IBIT'].forEach((s) => expect(syms).toContain(s));
  });
  it2('never emits advice language', () => {
    const r = analyzeMarketImpact({ text: 'Trump tariffs war oil crypto fed', urgency: 90 });
    const blob = JSON.stringify(r).toLowerCase();
    [' buy ', ' sell ', 'short ', 'long ', 'target price', 'guaranteed'].forEach((w) => expect(blob).not.toContain(w));
  });
});
