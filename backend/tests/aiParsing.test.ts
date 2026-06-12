import { describe, it, expect } from 'vitest';
import { parseAiResponse } from '../src/ai/schema.js';

const valid = {
  isMarketRelevant: true,
  riskLevel: 'Critical',
  categories: ['Tariffs', 'China'],
  summary: 'Possible 50% tariff on Chinese imports.',
  affectedSectors: ['Technology', 'Retail'],
  affectedTickers: ['AAPL', 'NVDA'],
  sentiment: 'Negative',
  urgencyScore: 95,
  reasoning: 'Direct tariff threat.',
  notificationTitle: 'CRITICAL: Trump tariff statement detected',
  notificationBody: 'Possible impact on China-linked stocks. Tap to view full statement.',
};

describe('AI response parsing', () => {
  it('parses a valid JSON response', () => {
    const r = parseAiResponse(JSON.stringify(valid));
    expect(r).not.toBeNull();
    expect(r!.riskLevel).toBe('Critical');
    expect(r!.urgencyScore).toBe(95);
  });

  it('tolerates markdown code fences', () => {
    const r = parseAiResponse('```json\n' + JSON.stringify(valid) + '\n```');
    expect(r).not.toBeNull();
  });

  it('tolerates surrounding prose', () => {
    const r = parseAiResponse('Here is the analysis:\n' + JSON.stringify(valid) + '\nDone.');
    expect(r).not.toBeNull();
  });

  it('rejects invalid risk levels', () => {
    expect(parseAiResponse(JSON.stringify({ ...valid, riskLevel: 'Extreme' }))).toBeNull();
  });

  it('rejects unknown categories (no fabricated taxonomy)', () => {
    expect(parseAiResponse(JSON.stringify({ ...valid, categories: ['Aliens'] }))).toBeNull();
  });

  it('rejects malformed ticker symbols', () => {
    expect(parseAiResponse(JSON.stringify({ ...valid, affectedTickers: ['apple inc'] }))).toBeNull();
  });

  it('rejects out-of-range urgency', () => {
    expect(parseAiResponse(JSON.stringify({ ...valid, urgencyScore: 200 }))).toBeNull();
  });

  it('rejects non-JSON output', () => {
    expect(parseAiResponse('I cannot analyze this statement.')).toBeNull();
    expect(parseAiResponse('')).toBeNull();
  });
});
