import { describe, it, expect } from 'vitest';
import { normalizeText, contentHash } from '../src/ingestion/dedupe.js';

describe('duplicate detection — normalization & hashing', () => {
  it('hashes identical statements identically', () => {
    const a = 'We may impose a 50% tariff on Chinese imports.';
    expect(contentHash(a)).toBe(contentHash(a));
  });

  it('ignores case, punctuation and whitespace differences', () => {
    const a = 'We may impose a 50% tariff on Chinese imports.';
    const b = '  WE MAY IMPOSE A 50% TARIFF ON CHINESE IMPORTS!!  ';
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it('ignores smart quotes and embedded URLs', () => {
    const a = '“We may impose a 50% tariff” https://example.com/post/1';
    const b = 'We may impose a 50% tariff';
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it('keeps percentages and dollar amounts significant', () => {
    expect(contentHash('a 50% tariff')).not.toBe(contentHash('a 25% tariff'));
  });

  it('produces different hashes for different statements', () => {
    expect(contentHash('Tariffs on China')).not.toBe(contentHash('Peace deal with Russia'));
  });

  it('normalizes to a stable canonical form', () => {
    expect(normalizeText('  Hello,   WORLD! ')).toBe('hello world');
  });
});
