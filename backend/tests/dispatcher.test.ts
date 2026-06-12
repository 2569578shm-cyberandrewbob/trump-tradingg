import { describe, it, expect } from 'vitest';
import { inQuietHours, matchesWatchlist, shouldNotify } from '../src/notifications/dispatcher.js';

const baseAlert = {
  id: 'a1',
  risk_level: 'High' as const,
  categories: ['Tariffs', 'China'],
  notification_title: 'HIGH: tariff statement',
  notification_body: 'body',
  summary: 's',
  confirmed: true,
  source_url: 'https://example.com',
  detected_at: new Date(),
  tickers: ['AAPL', 'NVDA'],
};

const baseUser = {
  user_id: 'u1',
  fcm_tokens: ['t1'],
  min_risk_level: 'High' as const,
  categories: [] as string[],
  tickers_only: false,
  quiet_hours_start: null as number | null,
  quiet_hours_end: null as number | null,
  timezone: 'UTC',
  watch_tickers: [] as string[],
};

describe('watchlist matching', () => {
  it('matches case-insensitively', () => {
    expect(matchesWatchlist(['AAPL', 'NVDA'], ['nvda'])).toEqual(['NVDA']);
  });
  it('returns empty when nothing matches', () => {
    expect(matchesWatchlist(['AAPL'], ['TSLA', 'BTC'])).toEqual([]);
  });
});

describe('quiet hours', () => {
  const at = (hourUtc: number) => new Date(Date.UTC(2026, 5, 12, hourUtc, 30));
  it('inside same-day window', () => {
    expect(inQuietHours(22, 7, 'UTC', at(23))).toBe(true);
  });
  it('overnight window wraps past midnight', () => {
    expect(inQuietHours(22, 7, 'UTC', at(3))).toBe(true);
    expect(inQuietHours(22, 7, 'UTC', at(12))).toBe(false);
  });
  it('disabled when unset', () => {
    expect(inQuietHours(null, null, 'UTC')).toBe(false);
  });
});

describe('notification decisions', () => {
  it('sends when risk meets the user threshold', () => {
    expect(shouldNotify(baseAlert, baseUser).send).toBe(true);
  });

  it('suppresses below-threshold risk', () => {
    const r = shouldNotify({ ...baseAlert, risk_level: 'Medium' }, baseUser);
    expect(r.send).toBe(false);
    expect(r.reason).toBe('suppressed_prefs');
  });

  it('watchlist match overrides risk threshold and personalizes', () => {
    const r = shouldNotify({ ...baseAlert, risk_level: 'Medium' }, { ...baseUser, watch_tickers: ['NVDA'] });
    expect(r.send).toBe(true);
    expect(r.personalized).toBe(true);
  });

  it('respects category filter', () => {
    const r = shouldNotify(baseAlert, { ...baseUser, categories: ['Crypto'] });
    expect(r.send).toBe(false);
  });

  it('tickers_only suppresses non-watchlist alerts', () => {
    expect(shouldNotify(baseAlert, { ...baseUser, tickers_only: true }).send).toBe(false);
    expect(shouldNotify(baseAlert, { ...baseUser, tickers_only: true, watch_tickers: ['AAPL'] }).send).toBe(true);
  });

  it('quiet hours suppress High but not Critical', () => {
    const sleepy = { ...baseUser, quiet_hours_start: 0, quiet_hours_end: 23 };
    expect(shouldNotify(baseAlert, sleepy).send).toBe(false);
    expect(shouldNotify({ ...baseAlert, risk_level: 'Critical' as const }, sleepy).send).toBe(true);
  });
});
