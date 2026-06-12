import { describe, it, expect } from 'vitest';
import { classifyWithRules } from '../src/ai/rulesClassifier.js';

describe('rule-based category classification (AI fallback)', () => {
  it('classifies the canonical tariff example', () => {
    const r = classifyWithRules('We may impose a 50% tariff on Chinese imports.');
    expect(r.isMarketRelevant).toBe(true);
    expect(r.categories).toContain('Tariffs');
    expect(r.categories).toContain('China');
    expect(['Medium', 'High']).toContain(r.riskLevel);
    expect(r.affectedTickers.length).toBeGreaterThan(0);
    expect(r.notificationBody).toContain('Tap to view full statement.');
  });

  it('never self-assigns Critical (conservative fallback)', () => {
    const r = classifyWithRules(
      'We WILL impose 100% tariffs on China TODAY, sanctions on Russia, and military action against Iran. Executive order signed.',
    );
    expect(r.riskLevel).not.toBe('Critical');
    expect(r.urgencyScore).toBeLessThanOrEqual(100);
  });

  it('detects war escalation with defense tickers', () => {
    const r = classifyWithRules('We are considering military action and strikes.');
    expect(r.categories).toContain('War escalation');
    expect(r.affectedTickers).toEqual(expect.arrayContaining(['LMT', 'RTX']));
    expect(r.sentiment).toBe('Negative');
  });

  it('detects ceasefire as positive sentiment', () => {
    const r = classifyWithRules('A great ceasefire and peace deal is coming.');
    expect(r.categories).toContain('Ceasefire / peace deal');
    expect(r.sentiment).toBe('Positive');
  });

  it('detects crypto statements', () => {
    const r = classifyWithRules('Bitcoin and crypto will make America the world leader.');
    expect(r.categories).toContain('Crypto');
    expect(r.affectedTickers).toEqual(expect.arrayContaining(['BTC', 'ETH']));
  });

  it('detects Fed statements', () => {
    const r = classifyWithRules('The Federal Reserve must cut interest rates now. Powell is too late!');
    expect(r.categories).toEqual(expect.arrayContaining(['Federal Reserve', 'Interest rates']));
  });

  it('maps company names to tickers', () => {
    const r = classifyWithRules('Apple and Nvidia are building plants in America.');
    expect(r.affectedTickers).toEqual(expect.arrayContaining(['AAPL', 'NVDA']));
    expect(r.categories).toContain('Specific companies');
  });

  it('marks non-market statements as not relevant', () => {
    const r = classifyWithRules('Happy birthday to a wonderful friend. Great person!');
    expect(r.isMarketRelevant).toBe(false);
    expect(r.riskLevel).toBe('Low');
    expect(r.affectedTickers).toHaveLength(0);
  });
});
