/**
 * Market-impact analyzer — deterministic, keyword-driven.
 *
 * Given a news/alert item it returns the assets that *may* react, with a
 * possible direction, a plain-English reason, and a confidence score.
 *
 * HARD RULES (informational only — never financial advice):
 *  - no buy/sell/short/long/enter/exit/target language
 *  - no invented prices
 *  - no fake certainty: weak links are labeled low confidence / "possible
 *    indirect impact"; unconfirmed items are capped below confirmed ones.
 */

export type Direction = 'positive' | 'negative' | 'mixed' | 'uncertain';
export type Strength = 'low' | 'medium' | 'high';
export type TimeSensitivity = 'immediate' | 'short-term' | 'medium-term';
export type AssetType = 'stock' | 'etf' | 'commodity' | 'currency' | 'crypto';

export interface AffectedAsset {
  symbol: string;
  name: string;
  asset_type: AssetType;
  sector: string;
  possible_impact: Direction;
  impact_reason: string;
  confidence: number;          // 0-100
  impact_strength: Strength;
  time_sensitivity: TimeSensitivity;
  keywords_matched: string[];
  risk_note: string;
}
export interface AffectedEtf { symbol: string; name: string; category: string; possible_impact: Direction; reason: string; confidence: number; }
export interface AffectedCommodity { symbol: string; name: string; possible_impact: Direction; reason: string; confidence: number; }
export interface AffectedMacro { asset: string; possible_impact: Direction; reason: string; confidence: number; }

export interface MarketImpact {
  affected_assets: AffectedAsset[];
  affected_etfs: AffectedEtf[];
  affected_commodities: AffectedCommodity[];
  affected_macro_assets: AffectedMacro[];
  market_impact_summary: string;
}

export interface ImpactInput {
  text: string;
  categories?: string[];
  urgency?: number;            // 0-100
  confirmationCount?: number;
  sourceReliability?: number;  // 0-100
}

// ── Asset registry: symbol → metadata ──────────────────────────────────────
interface Meta { name: string; type: AssetType; sector: string; etfCategory?: string; }
const A: Record<string, Meta> = {
  // Defense
  LMT: { name: 'Lockheed Martin', type: 'stock', sector: 'Defense' },
  RTX: { name: 'RTX (Raytheon)', type: 'stock', sector: 'Defense' },
  NOC: { name: 'Northrop Grumman', type: 'stock', sector: 'Defense' },
  GD: { name: 'General Dynamics', type: 'stock', sector: 'Defense' },
  BA: { name: 'Boeing', type: 'stock', sector: 'Aerospace/Defense' },
  LHX: { name: 'L3Harris', type: 'stock', sector: 'Defense' },
  HII: { name: 'Huntington Ingalls', type: 'stock', sector: 'Defense' },
  ITA: { name: 'iShares U.S. Aerospace & Defense ETF', type: 'etf', sector: 'Defense', etfCategory: 'Defense ETF' },
  XAR: { name: 'SPDR S&P Aerospace & Defense ETF', type: 'etf', sector: 'Defense', etfCategory: 'Defense ETF' },
  PPA: { name: 'Invesco Aerospace & Defense ETF', type: 'etf', sector: 'Defense', etfCategory: 'Defense ETF' },
  // Energy
  XOM: { name: 'ExxonMobil', type: 'stock', sector: 'Energy' },
  CVX: { name: 'Chevron', type: 'stock', sector: 'Energy' },
  COP: { name: 'ConocoPhillips', type: 'stock', sector: 'Energy' },
  SLB: { name: 'SLB (Schlumberger)', type: 'stock', sector: 'Energy' },
  HAL: { name: 'Halliburton', type: 'stock', sector: 'Energy' },
  OXY: { name: 'Occidental Petroleum', type: 'stock', sector: 'Energy' },
  BP: { name: 'BP', type: 'stock', sector: 'Energy' },
  SHEL: { name: 'Shell', type: 'stock', sector: 'Energy' },
  XLE: { name: 'Energy Select Sector SPDR', type: 'etf', sector: 'Energy', etfCategory: 'Energy ETF' },
  VDE: { name: 'Vanguard Energy ETF', type: 'etf', sector: 'Energy', etfCategory: 'Energy ETF' },
  XOP: { name: 'SPDR S&P Oil & Gas E&P ETF', type: 'etf', sector: 'Energy', etfCategory: 'Energy ETF' },
  USO: { name: 'United States Oil Fund', type: 'etf', sector: 'Energy', etfCategory: 'Oil ETF' },
  BNO: { name: 'United States Brent Oil Fund', type: 'etf', sector: 'Energy', etfCategory: 'Oil ETF' },
  CL: { name: 'Crude Oil (WTI)', type: 'commodity', sector: 'Energy' },
  // Safe haven
  GLD: { name: 'SPDR Gold Shares', type: 'etf', sector: 'Commodities', etfCategory: 'Gold ETF' },
  IAU: { name: 'iShares Gold Trust', type: 'etf', sector: 'Commodities', etfCategory: 'Gold ETF' },
  // Airlines / logistics
  DAL: { name: 'Delta Air Lines', type: 'stock', sector: 'Airlines' },
  UAL: { name: 'United Airlines', type: 'stock', sector: 'Airlines' },
  AAL: { name: 'American Airlines', type: 'stock', sector: 'Airlines' },
  LUV: { name: 'Southwest Airlines', type: 'stock', sector: 'Airlines' },
  FDX: { name: 'FedEx', type: 'stock', sector: 'Logistics' },
  UPS: { name: 'UPS', type: 'stock', sector: 'Logistics' },
  ZIM: { name: 'ZIM Integrated Shipping', type: 'stock', sector: 'Shipping' },
  // Broad indices
  SPY: { name: 'SPDR S&P 500 ETF', type: 'etf', sector: 'Broad Market', etfCategory: 'Broad Index ETF' },
  QQQ: { name: 'Invesco QQQ (Nasdaq 100)', type: 'etf', sector: 'Broad Market', etfCategory: 'Broad Index ETF' },
  DIA: { name: 'SPDR Dow Jones ETF', type: 'etf', sector: 'Broad Market', etfCategory: 'Broad Index ETF' },
  IWM: { name: 'iShares Russell 2000 ETF', type: 'etf', sector: 'Broad Market', etfCategory: 'Broad Index ETF' },
  // China / trade
  FXI: { name: 'iShares China Large-Cap ETF', type: 'etf', sector: 'China', etfCategory: 'China ETF' },
  MCHI: { name: 'iShares MSCI China ETF', type: 'etf', sector: 'China', etfCategory: 'China ETF' },
  KWEB: { name: 'KraneShares China Internet ETF', type: 'etf', sector: 'China', etfCategory: 'China ETF' },
  // Retail
  WMT: { name: 'Walmart', type: 'stock', sector: 'Retail' },
  TGT: { name: 'Target', type: 'stock', sector: 'Retail' },
  COST: { name: 'Costco', type: 'stock', sector: 'Retail' },
  HD: { name: 'Home Depot', type: 'stock', sector: 'Retail' },
  LOW: { name: "Lowe's", type: 'stock', sector: 'Retail' },
  AMZN: { name: 'Amazon', type: 'stock', sector: 'Technology/Retail' },
  // Industrials
  CAT: { name: 'Caterpillar', type: 'stock', sector: 'Industrials' },
  DE: { name: 'Deere', type: 'stock', sector: 'Industrials' },
  GE: { name: 'GE Aerospace', type: 'stock', sector: 'Industrials' },
  // Semiconductors
  NVDA: { name: 'Nvidia', type: 'stock', sector: 'Semiconductors' },
  AMD: { name: 'AMD', type: 'stock', sector: 'Semiconductors' },
  INTC: { name: 'Intel', type: 'stock', sector: 'Semiconductors' },
  AVGO: { name: 'Broadcom', type: 'stock', sector: 'Semiconductors' },
  QCOM: { name: 'Qualcomm', type: 'stock', sector: 'Semiconductors' },
  TSM: { name: 'TSMC', type: 'stock', sector: 'Semiconductors' },
  ASML: { name: 'ASML', type: 'stock', sector: 'Semiconductors' },
  // Auto
  TSLA: { name: 'Tesla', type: 'stock', sector: 'Automotive' },
  GM: { name: 'General Motors', type: 'stock', sector: 'Automotive' },
  F: { name: 'Ford', type: 'stock', sector: 'Automotive' },
  TM: { name: 'Toyota', type: 'stock', sector: 'Automotive' },
  // Steel / aluminum
  X: { name: 'U.S. Steel', type: 'stock', sector: 'Materials' },
  NUE: { name: 'Nucor', type: 'stock', sector: 'Materials' },
  STLD: { name: 'Steel Dynamics', type: 'stock', sector: 'Materials' },
  AA: { name: 'Alcoa', type: 'stock', sector: 'Materials' },
  CENX: { name: 'Century Aluminum', type: 'stock', sector: 'Materials' },
  // Crypto
  COIN: { name: 'Coinbase', type: 'stock', sector: 'Crypto' },
  MSTR: { name: 'MicroStrategy', type: 'stock', sector: 'Crypto' },
  MARA: { name: 'Marathon Digital', type: 'stock', sector: 'Crypto' },
  RIOT: { name: 'Riot Platforms', type: 'stock', sector: 'Crypto' },
  HOOD: { name: 'Robinhood', type: 'stock', sector: 'Crypto/Fintech' },
  IBIT: { name: 'iShares Bitcoin Trust', type: 'etf', sector: 'Crypto', etfCategory: 'Bitcoin ETF' },
  GBTC: { name: 'Grayscale Bitcoin Trust', type: 'etf', sector: 'Crypto', etfCategory: 'Bitcoin ETF' },
  BITO: { name: 'ProShares Bitcoin Strategy ETF', type: 'etf', sector: 'Crypto', etfCategory: 'Bitcoin ETF' },
  BTC: { name: 'Bitcoin', type: 'crypto', sector: 'Crypto' },
  ETH: { name: 'Ethereum', type: 'crypto', sector: 'Crypto' },
  // Banks / rates / macro
  JPM: { name: 'JPMorgan Chase', type: 'stock', sector: 'Banking' },
  BAC: { name: 'Bank of America', type: 'stock', sector: 'Banking' },
  WFC: { name: 'Wells Fargo', type: 'stock', sector: 'Banking' },
  C: { name: 'Citigroup', type: 'stock', sector: 'Banking' },
  GS: { name: 'Goldman Sachs', type: 'stock', sector: 'Banking' },
  MS: { name: 'Morgan Stanley', type: 'stock', sector: 'Banking' },
  KRE: { name: 'SPDR S&P Regional Banking ETF', type: 'etf', sector: 'Banking', etfCategory: 'Regional Banks ETF' },
  TLT: { name: 'iShares 20+ Year Treasury ETF', type: 'etf', sector: 'Bonds', etfCategory: 'Treasury ETF' },
  IEF: { name: 'iShares 7-10 Year Treasury ETF', type: 'etf', sector: 'Bonds', etfCategory: 'Treasury ETF' },
  SHY: { name: 'iShares 1-3 Year Treasury ETF', type: 'etf', sector: 'Bonds', etfCategory: 'Treasury ETF' },
  UUP: { name: 'Invesco DB US Dollar Index Fund', type: 'etf', sector: 'Currency', etfCategory: 'Dollar ETF' },
  USD: { name: 'US Dollar', type: 'currency', sector: 'Currency' },
  MSFT: { name: 'Microsoft', type: 'stock', sector: 'Technology' },
  AAPL: { name: 'Apple', type: 'stock', sector: 'Technology' },
  META: { name: 'Meta Platforms', type: 'stock', sector: 'Technology' },
  GOOGL: { name: 'Alphabet (Google)', type: 'stock', sector: 'Technology' },
  IBM: { name: 'IBM', type: 'stock', sector: 'Technology' },
  PLTR: { name: 'Palantir', type: 'stock', sector: 'Technology' },
};

// ── Themes: keyword pattern → asset reactions ───────────────────────────────
interface Leg { symbols: string[]; dir: Direction; reason: string; base: number; time: TimeSensitivity; }
interface Theme { key: string; pattern: RegExp; legs: Leg[]; }

const THEMES: Theme[] = [
  {
    key: 'War / escalation',
    // Note: "trade war" / "price war" are neutralized before matching (see themeText).
    pattern: /\b(war|warfare|strike|air ?strike|attack|invasion|invade|missile|nuclear|troops|military|offensive|bombard|hostilit\w*|iran|russia|ukraine|middle east|gaza|israel|hezbollah|hamas|kremlin|putin|zelensky)\b/i,
    legs: [
      { symbols: ['LMT', 'RTX', 'NOC', 'GD', 'BA', 'LHX', 'HII'], dir: 'positive', base: 70, time: 'immediate', reason: 'Defense names may react to war/escalation and higher military-spending expectations.' },
      { symbols: ['ITA', 'XAR', 'PPA'], dir: 'positive', base: 68, time: 'immediate', reason: 'Defense-sector ETFs may move on escalation headlines.' },
      { symbols: ['XOM', 'CVX', 'COP', 'SLB', 'HAL', 'OXY', 'BP', 'SHEL'], dir: 'positive', base: 60, time: 'immediate', reason: 'Energy names may react to supply-risk concerns from conflict.' },
      { symbols: ['USO', 'BNO', 'CL'], dir: 'positive', base: 62, time: 'immediate', reason: 'Oil may price in supply risk during conflict.' },
      { symbols: ['GLD', 'IAU'], dir: 'positive', base: 58, time: 'immediate', reason: 'Gold may see safe-haven demand during geopolitical stress.' },
      { symbols: ['USD'], dir: 'positive', base: 46, time: 'immediate', reason: 'The dollar may see safe-haven demand during geopolitical stress.' },
      { symbols: ['DAL', 'UAL', 'AAL', 'LUV'], dir: 'negative', base: 50, time: 'short-term', reason: 'Airlines carry negative sensitivity to higher fuel costs / travel risk.' },
      { symbols: ['FDX', 'UPS', 'ZIM'], dir: 'mixed', base: 42, time: 'short-term', reason: 'Logistics/shipping may be affected by route and fuel disruption.' },
      { symbols: ['SPY', 'QQQ', 'DIA', 'IWM'], dir: 'uncertain', base: 38, time: 'short-term', reason: 'Broad indices may see risk-off volatility.' },
    ],
  },
  {
    key: 'Ceasefire / de-escalation',
    pattern: /\b(ceasefire|cease-fire|truce|peace deal|peace agreement|de-?escalat\w*|armistice)\b/i,
    legs: [
      { symbols: ['LMT', 'RTX', 'NOC', 'GD'], dir: 'mixed', base: 55, time: 'short-term', reason: 'Defense names may face mixed/softer reaction if conflict risk eases.' },
      { symbols: ['XOM', 'CVX', 'USO', 'CL'], dir: 'negative', base: 52, time: 'short-term', reason: 'Oil-linked names may ease if supply risk falls.' },
      { symbols: ['DAL', 'UAL', 'AAL', 'LUV'], dir: 'positive', base: 50, time: 'short-term', reason: 'Airlines may benefit from lower fuel-risk and travel normalization.' },
      { symbols: ['SPY', 'QQQ', 'DIA'], dir: 'positive', base: 45, time: 'short-term', reason: 'Broad market may react positively to reduced geopolitical risk.' },
      { symbols: ['GLD', 'IAU'], dir: 'negative', base: 45, time: 'short-term', reason: 'Gold safe-haven demand may soften on de-escalation.' },
    ],
  },
  {
    key: 'Tariffs / trade war',
    pattern: /\b(tariff\w*|trade war|import duty|customs|export control|trade deal)\b/i,
    legs: [
      { symbols: ['FXI', 'MCHI', 'KWEB'], dir: 'negative', base: 60, time: 'short-term', reason: 'China-exposed ETFs may react to tariff/trade-war headlines.' },
      { symbols: ['WMT', 'TGT', 'COST', 'HD', 'LOW', 'AMZN'], dir: 'negative', base: 52, time: 'short-term', reason: 'Importers/retailers may face cost pressure from tariffs.' },
      { symbols: ['CAT', 'DE', 'BA', 'GE'], dir: 'mixed', base: 45, time: 'medium-term', reason: 'Industrials may see mixed effects from trade policy.' },
      { symbols: ['NVDA', 'AMD', 'INTC', 'AVGO', 'QCOM', 'TSM', 'ASML'], dir: 'negative', base: 55, time: 'short-term', reason: 'Semiconductors are sensitive to China trade restrictions.' },
      { symbols: ['TSLA', 'GM', 'F', 'TM'], dir: 'mixed', base: 44, time: 'medium-term', reason: 'Automakers have cross-border supply chains exposed to tariffs.' },
      { symbols: ['X', 'NUE', 'STLD', 'AA', 'CENX'], dir: 'positive', base: 50, time: 'short-term', reason: 'Domestic steel/aluminum may benefit from import tariffs.' },
      { symbols: ['SPY', 'QQQ', 'DIA'], dir: 'uncertain', base: 38, time: 'short-term', reason: 'Broad indices may see trade-policy volatility.' },
    ],
  },
  {
    key: 'China',
    pattern: /\b(china|chinese|beijing|xi jinping)\b/i,
    legs: [
      { symbols: ['FXI', 'MCHI', 'KWEB'], dir: 'uncertain', base: 50, time: 'short-term', reason: 'China-focused ETFs may react to China-related policy news.' },
      { symbols: ['NVDA', 'AMD', 'TSM', 'ASML'], dir: 'mixed', base: 46, time: 'short-term', reason: 'Semiconductor supply chains are China-sensitive.' },
    ],
  },
  {
    key: 'Oil / OPEC / sanctions',
    pattern: /\b(oil|opec\+?|crude|barrel|drilling|strait of hormuz|sanction\w*|embargo|pipeline)\b/i,
    legs: [
      { symbols: ['CL', 'USO', 'BNO'], dir: 'positive', base: 60, time: 'immediate', reason: 'Oil benchmarks may react to supply/sanctions news.' },
      { symbols: ['XOM', 'CVX', 'COP', 'OXY', 'SLB', 'HAL', 'BP', 'SHEL'], dir: 'positive', base: 56, time: 'short-term', reason: 'Energy producers/services may react to oil-supply news.' },
      { symbols: ['XLE', 'VDE', 'XOP'], dir: 'positive', base: 54, time: 'short-term', reason: 'Energy-sector ETFs may move with oil.' },
      { symbols: ['DAL', 'UAL', 'AAL', 'LUV'], dir: 'negative', base: 48, time: 'short-term', reason: 'Airlines carry negative sensitivity to higher fuel costs.' },
      { symbols: ['FDX', 'UPS', 'ZIM'], dir: 'negative', base: 42, time: 'short-term', reason: 'Logistics costs rise with fuel; shipping routes may be disrupted.' },
    ],
  },
  {
    key: 'Crypto',
    pattern: /\b(crypto\w*|bitcoin|btc|ethereum|eth|digital asset|stablecoin|coinbase)\b/i,
    legs: [
      { symbols: ['BTC', 'ETH'], dir: 'uncertain', base: 58, time: 'immediate', reason: 'Crypto assets may react to policy/regulation headlines.' },
      { symbols: ['COIN', 'MSTR', 'MARA', 'RIOT', 'HOOD'], dir: 'uncertain', base: 54, time: 'short-term', reason: 'Crypto-linked equities may track crypto sentiment/regulation.' },
      { symbols: ['IBIT', 'GBTC', 'BITO'], dir: 'uncertain', base: 52, time: 'short-term', reason: 'Bitcoin ETFs may react to crypto policy news.' },
    ],
  },
  {
    key: 'Federal Reserve / rates / dollar',
    pattern: /\b(federal reserve|the fed|fed\b|powell|interest rate\w*|rate cut|rate hike|inflation|cpi|dollar|monetary policy)\b/i,
    legs: [
      { symbols: ['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS'], dir: 'mixed', base: 50, time: 'short-term', reason: 'Banks are sensitive to rate-path and Fed policy.' },
      { symbols: ['KRE'], dir: 'mixed', base: 48, time: 'short-term', reason: 'Regional-bank ETF is rate-sensitive.' },
      { symbols: ['TLT', 'IEF', 'SHY'], dir: 'uncertain', base: 52, time: 'immediate', reason: 'Treasury ETFs move directly with rate expectations.' },
      { symbols: ['GLD', 'IAU'], dir: 'uncertain', base: 44, time: 'short-term', reason: 'Gold reacts to real-rate and dollar moves.' },
      { symbols: ['USD', 'UUP'], dir: 'uncertain', base: 46, time: 'short-term', reason: 'Dollar may react to Fed policy and macro news.' },
      { symbols: ['QQQ', 'NVDA', 'MSFT', 'AAPL', 'AMZN', 'META', 'GOOGL'], dir: 'mixed', base: 44, time: 'short-term', reason: 'Growth/tech valuations are rate-sensitive.' },
      { symbols: ['SPY', 'DIA'], dir: 'uncertain', base: 38, time: 'short-term', reason: 'Broad indices react to rate path.' },
    ],
  },
];

// Direct company mentions → always included as named stocks.
const COMPANY_NAMES: Record<string, string> = {
  apple: 'AAPL', nvidia: 'NVDA', tesla: 'TSLA', microsoft: 'MSFT', meta: 'META',
  facebook: 'META', amazon: 'AMZN', google: 'GOOGL', alphabet: 'GOOGL', boeing: 'BA',
  'lockheed': 'LMT', raytheon: 'RTX', exxon: 'XOM', chevron: 'CVX', walmart: 'WMT',
  intel: 'INTC', 'goldman sachs': 'GS', jpmorgan: 'JPM', ibm: 'IBM', palantir: 'PLTR',
  coinbase: 'COIN', microstrategy: 'MSTR', nucor: 'NUE', 'u.s. steel': 'X', alcoa: 'AA',
};

const STRENGTH = (c: number): Strength => (c >= 70 ? 'high' : c >= 45 ? 'medium' : 'low');
const RISK_NOTE = 'Market reaction is uncertain and may differ with confirmation and broader macro conditions. Informational only — not financial advice.';

interface Acc { meta: Meta; symbol: string; dir: Direction; reason: string; confidence: number; time: TimeSensitivity; keywords: Set<string>; }

export function analyzeMarketImpact(input: ImpactInput): MarketImpact {
  const text = input.text || '';
  const urgency = input.urgency ?? 0;
  const confirmations = input.confirmationCount ?? 0;
  const reliability = input.sourceReliability ?? 50;

  // Confidence modifiers shared by every leg.
  const relAdj = (reliability - 50) / 5;            // -10..+10
  const urgAdj = urgency / 10;                       // 0..+10
  const confAdj = Math.min(confirmations * 5, 15);   // 0..+15
  const confirmedItem = confirmations > 0;

  // Neutralize non-military "war" phrases so the conflict theme doesn't misfire.
  const themeText = text.replace(/\b(trade|price|bidding|culture|currency|tariff|tariffs|bid|turf)\s+war(s|fare)?\b/gi, '$1 dispute');

  const map = new Map<string, Acc>();
  const matchedThemes: { key: string; strongest: number }[] = [];

  const add = (symbol: string, dir: Direction, reason: string, base: number, time: TimeSensitivity, kw: string[]) => {
    const meta = A[symbol];
    if (!meta) return;
    let confidence = Math.round(base + relAdj + urgAdj + confAdj);
    if (!confirmedItem) confidence = Math.min(confidence, 80); // unconfirmed cap
    confidence = Math.max(10, Math.min(confidence, 95));
    const existing = map.get(symbol);
    if (existing) {
      if (existing.dir !== dir) existing.dir = 'mixed';
      existing.confidence = Math.max(existing.confidence, confidence);
      kw.forEach((k) => existing.keywords.add(k));
    } else {
      map.set(symbol, { meta, symbol, dir, reason, confidence, time, keywords: new Set(kw) });
    }
  };

  for (const theme of THEMES) {
    const m = themeText.match(theme.pattern);
    if (!m) continue;
    matchedThemes.push({ key: theme.key, strongest: Math.max(...theme.legs.map((l) => l.base)) });
    const kw = [m[0].toLowerCase()];
    for (const leg of theme.legs) {
      for (const sym of leg.symbols) add(sym, leg.dir, leg.reason, leg.base, leg.time, kw);
    }
  }

  // Direct company mentions (high confidence — explicitly named).
  const lower = text.toLowerCase();
  for (const [name, sym] of Object.entries(COMPANY_NAMES)) {
    if (lower.includes(name)) add(sym, 'uncertain', `Directly named in the statement (${A[sym]?.name ?? sym}).`, 72, 'immediate', [name]);
  }

  const accs = [...map.values()].sort((a, b) => b.confidence - a.confidence);

  const affected_assets: AffectedAsset[] = accs
    .filter((x) => x.meta.type === 'stock')
    .slice(0, 20)
    .map((x) => ({
      symbol: x.symbol, name: x.meta.name, asset_type: x.meta.type, sector: x.meta.sector,
      possible_impact: x.dir, impact_reason: x.reason, confidence: x.confidence,
      impact_strength: STRENGTH(x.confidence), time_sensitivity: x.time,
      keywords_matched: [...x.keywords], risk_note: RISK_NOTE,
    }));
  const affected_etfs: AffectedEtf[] = accs
    .filter((x) => x.meta.type === 'etf')
    .slice(0, 10)
    .map((x) => ({ symbol: x.symbol, name: x.meta.name, category: x.meta.etfCategory ?? 'ETF', possible_impact: x.dir, reason: x.reason, confidence: x.confidence }));
  const affected_commodities: AffectedCommodity[] = accs
    .filter((x) => x.meta.type === 'commodity')
    .map((x) => ({ symbol: x.symbol, name: x.meta.name, possible_impact: x.dir, reason: x.reason, confidence: x.confidence }));
  const affected_macro_assets: AffectedMacro[] = accs
    .filter((x) => x.meta.type === 'crypto' || x.meta.type === 'currency')
    .map((x) => ({ asset: x.symbol === 'UUP' ? 'USD' : x.symbol, possible_impact: x.dir, reason: x.reason, confidence: x.confidence }));

  return {
    affected_assets, affected_etfs, affected_commodities, affected_macro_assets,
    market_impact_summary: buildSummary(matchedThemes, affected_assets, affected_etfs, confirmedItem),
  };
}

function buildSummary(themes: { key: string }[], stocks: AffectedAsset[], etfs: AffectedEtf[], confirmed: boolean): string {
  if (!themes.length && !stocks.length && !etfs.length) {
    return 'No clear market-impact link detected for this item.';
  }
  const sectors = [...new Set([...stocks, ...etfs.map((e) => ({ sector: e.category }))].map((x: { sector: string }) => x.sector))].slice(0, 4);
  const themeList = themes.map((t) => t.key).slice(0, 3).join(', ');
  const conf = confirmed ? 'Corroborated by multiple sources.' : 'Unconfirmed single-source report — treat with lower confidence.';
  const base = themeList
    ? `Possible themes: ${themeList}. Sectors that may react: ${sectors.join(', ')}.`
    : `Sectors that may react: ${sectors.join(', ')}.`;
  return `${base} ${conf} Reactions are uncertain — informational only, not financial advice.`;
}
