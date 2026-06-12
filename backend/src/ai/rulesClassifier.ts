import type { AiAnalysis, Category, RiskLevel, Sentiment } from '../lib/types.js';

/**
 * Deterministic keyword fallback used when the AI is unavailable or returns
 * invalid JSON. Conservative by design: it never produces Critical on its own
 * unless multiple strong signals are present.
 */

interface Rule {
  pattern: RegExp;
  categories: Category[];
  sectors: string[];
  tickers: string[];
  weight: number; // contribution to urgency
  sentiment?: Sentiment;
}

const RULES: Rule[] = [
  { pattern: /\btariff(s)?\b/i, categories: ['Tariffs', 'Trade deals'], sectors: ['Technology', 'Retail', 'Industrials'], tickers: ['AAPL', 'WMT', 'NVDA'], weight: 35, sentiment: 'Negative' },
  { pattern: /\bchina|chinese|beijing\b/i, categories: ['China'], sectors: ['Technology', 'Semiconductors'], tickers: ['BABA', 'TSM', 'NVDA'], weight: 25 },
  { pattern: /\bsanction(s|ed)?\b/i, categories: ['Sanctions'], sectors: ['Energy', 'Banking'], tickers: ['XOM', 'JPM'], weight: 30, sentiment: 'Negative' },
  { pattern: /\bwar|strike(s)?|military action|attack|invasion\b/i, categories: ['War escalation'], sectors: ['Defense', 'Energy'], tickers: ['LMT', 'RTX', 'OIL', 'GOLD'], weight: 40, sentiment: 'Negative' },
  { pattern: /\bceasefire|peace deal|peace agreement|truce\b/i, categories: ['Ceasefire / peace deal'], sectors: ['Energy', 'Defense'], tickers: ['OIL', 'LMT'], weight: 35, sentiment: 'Positive' },
  { pattern: /\brussia(n)?|moscow|putin\b/i, categories: ['Russia'], sectors: ['Energy', 'Defense'], tickers: ['OIL', 'LMT'], weight: 20 },
  { pattern: /\bukraine|kyiv|zelensky\b/i, categories: ['Ukraine'], sectors: ['Defense', 'Agriculture'], tickers: ['LMT', 'RTX'], weight: 20 },
  { pattern: /\biran(ian)?|tehran\b/i, categories: ['Iran', 'Middle East'], sectors: ['Energy', 'Defense'], tickers: ['OIL', 'XOM', 'LMT'], weight: 30 },
  { pattern: /\bmiddle east|israel|gaza|saudi\b/i, categories: ['Middle East'], sectors: ['Energy', 'Defense'], tickers: ['OIL', 'XOM'], weight: 25 },
  { pattern: /\boil|opec|barrel|drilling\b/i, categories: ['Oil', 'Energy sector'], sectors: ['Energy'], tickers: ['OIL', 'XOM', 'CVX'], weight: 25 },
  { pattern: /\bgold\b/i, categories: ['Gold'], sectors: ['Commodities'], tickers: ['GOLD'], weight: 15 },
  { pattern: /\bbitcoin|crypto(currency)?|btc|ethereum|eth\b/i, categories: ['Crypto'], sectors: ['Crypto'], tickers: ['BTC', 'ETH'], weight: 25 },
  { pattern: /\binterest rate(s)?|rate cut|rate hike\b/i, categories: ['Interest rates'], sectors: ['Banking', 'Real Estate'], tickers: ['JPM', 'BAC'], weight: 30 },
  { pattern: /\bfed(eral reserve)?\b|powell/i, categories: ['Federal Reserve'], sectors: ['Banking'], tickers: ['JPM', 'BAC'], weight: 30 },
  { pattern: /\binflation|cpi|prices are\b/i, categories: ['Inflation'], sectors: ['Consumer', 'Banking'], tickers: [], weight: 20 },
  { pattern: /\btax(es|ation)?\b/i, categories: ['Taxes'], sectors: ['Consumer', 'Industrials'], tickers: [], weight: 20 },
  { pattern: /\btrade deal|trade agreement|trade war\b/i, categories: ['Trade deals'], sectors: ['Industrials', 'Technology'], tickers: [], weight: 25 },
  { pattern: /\bdefense|pentagon\b/i, categories: ['Defense sector'], sectors: ['Defense'], tickers: ['LMT', 'RTX'], weight: 20 },
  { pattern: /\bsemiconductor(s)?|chip(s)?\b/i, categories: ['Technology sector'], sectors: ['Semiconductors'], tickers: ['NVDA', 'TSM', 'AMD'], weight: 25 },
  { pattern: /\bpharma(ceutical)?(s)?|drug price(s)?\b/i, categories: ['Pharmaceuticals'], sectors: ['Healthcare'], tickers: ['PFE', 'MRK'], weight: 20 },
];

const COMPANY_TICKERS: Record<string, string> = {
  apple: 'AAPL', nvidia: 'NVDA', tesla: 'TSLA', microsoft: 'MSFT', meta: 'META',
  facebook: 'META', amazon: 'AMZN', google: 'GOOGL', alphabet: 'GOOGL', boeing: 'BA',
  lockheed: 'LMT', raytheon: 'RTX', exxon: 'XOM', chevron: 'CVX', walmart: 'WMT',
  intel: 'INTC', amd: 'AMD', palantir: 'PLTR', ibm: 'IBM', jpmorgan: 'JPM',
};

const ESCALATORS = /\bwill\b|\bimmediately\b|\btoday\b|\bsigned\b|\bannounce\b|executive order|\d{1,3}\s?%/i;

export function classifyWithRules(statement: string): AiAnalysis {
  const categories = new Set<Category>();
  const sectors = new Set<string>();
  const tickers = new Set<string>();
  let urgency = 0;
  let negative = 0;
  let positive = 0;

  for (const rule of RULES) {
    if (!rule.pattern.test(statement)) continue;
    rule.categories.forEach((c) => categories.add(c));
    rule.sectors.forEach((s) => sectors.add(s));
    rule.tickers.forEach((t) => tickers.add(t));
    urgency += rule.weight;
    if (rule.sentiment === 'Negative') negative++;
    if (rule.sentiment === 'Positive') positive++;
  }

  const lower = statement.toLowerCase();
  for (const [name, ticker] of Object.entries(COMPANY_TICKERS)) {
    if (lower.includes(name)) {
      tickers.add(ticker);
      categories.add('Specific companies');
      urgency += 10;
    }
  }

  if (ESCALATORS.test(statement)) urgency += 20;
  urgency = Math.min(urgency, 100);

  const isMarketRelevant = categories.size > 0 && urgency >= 20;
  let riskLevel: RiskLevel = 'Low';
  if (isMarketRelevant) {
    if (urgency >= 80) riskLevel = 'High'; // fallback never self-assigns Critical
    else if (urgency >= 50) riskLevel = 'Medium';
  }

  const sentiment: Sentiment =
    negative > 0 && positive > 0 ? 'Mixed' : negative > 0 ? 'Negative' : positive > 0 ? 'Positive' : 'Neutral';

  const catList = [...categories].slice(0, 4);
  const topic = catList[0] ?? 'statement';
  return {
    isMarketRelevant,
    riskLevel,
    categories: catList,
    summary: isMarketRelevant
      ? `Statement mentions ${catList.join(', ')}. Markets exposed to these themes may react. (Automated keyword classification — AI analysis unavailable.)`
      : 'No clear market-moving content detected by keyword classification.',
    affectedSectors: [...sectors].slice(0, 6),
    affectedTickers: [...tickers].slice(0, 10),
    sentiment,
    urgencyScore: urgency,
    reasoning: 'Rule-based keyword fallback classifier; conservative risk ceiling of High.',
    notificationTitle: `${riskLevel.toUpperCase()}: Trump ${topic} statement detected`,
    notificationBody: `Possible impact on ${[...sectors].slice(0, 3).join(', ') || 'markets'}. Tap to view full statement.`,
  };
}
