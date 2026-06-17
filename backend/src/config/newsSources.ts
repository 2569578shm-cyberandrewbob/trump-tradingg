/**
 * Central news-source catalog (requirement: src/config/newsSources.ts).
 *
 * This is the single source of truth for the Market News system. The live web
 * PWA (docs/index.html) mirrors this catalog in plain JS today; when the backend
 * news endpoints are built they should import from here so the two never drift.
 *
 * Legal/robustness note: we never scrape fragile HTML. A source is either
 *  - 'rss'             → fetched via Google News RSS search (keyless, legal), or
 *  - 'official'        → an official government/regulator RSS feed, or
 *  - 'api'             → a documented public API (key may be required), or
 *  - 'external_search' → not machine-fetchable; surfaced as a deep link only.
 */

export type NewsSourceType = 'rss' | 'api' | 'official' | 'external_search';

export type NewsCategory =
  | 'General market'
  | 'Stock-specific'
  | 'Economy'
  | 'Fed / rates'
  | 'Earnings'
  | 'Commodities'
  | 'Crypto'
  | 'Trump / Tariffs'
  | 'FDA / Biotech'
  | 'Semiconductors'
  | 'AI / Data Center'
  | 'Energy / Utilities'
  | 'Official Filings'
  | 'Economic calendar'
  | 'Analyst';

export interface NewsSource {
  id: string;
  name: string;
  category: NewsCategory;
  type: NewsSourceType;
  /** Direct feed URL (official RSS/api) OR a template function for searches/links. */
  url?: string;
  /** For external_search / rss-by-ticker: build a URL from a ticker symbol. */
  urlTemplate?: (ticker: string) => string;
  enabled: boolean;
  /** Higher = preferred when deduping / ordering. */
  priority: number;
  /** Optional list of tickers this source is especially good for. */
  supportedTickers?: string[];
  note?: string;
}

const gnews = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

export const NEWS_SOURCES: NewsSource[] = [
  // ── Fetchable via Google News RSS (keyless, legal) ──
  { id: 'google_news', name: 'Google News', category: 'General market', type: 'rss', enabled: true, priority: 9, urlTemplate: (t) => gnews(`${t} stock when:3d`) },
  { id: 'reuters', name: 'Reuters', category: 'General market', type: 'rss', enabled: true, priority: 9, urlTemplate: (t) => gnews(`${t} site:reuters.com when:3d`) },
  { id: 'cnbc', name: 'CNBC', category: 'General market', type: 'rss', enabled: true, priority: 8, urlTemplate: (t) => gnews(`${t} site:cnbc.com when:3d`) },
  { id: 'yahoo_finance', name: 'Yahoo Finance', category: 'Stock-specific', type: 'rss', enabled: true, priority: 8, urlTemplate: (t) => gnews(`${t} site:finance.yahoo.com when:3d`) },
  { id: 'marketwatch', name: 'MarketWatch', category: 'General market', type: 'rss', enabled: true, priority: 7, urlTemplate: (t) => gnews(`${t} site:marketwatch.com when:3d`) },
  { id: 'benzinga', name: 'Benzinga', category: 'Stock-specific', type: 'rss', enabled: true, priority: 6, urlTemplate: (t) => gnews(`${t} site:benzinga.com when:3d`) },
  { id: 'nasdaq', name: 'Nasdaq', category: 'Stock-specific', type: 'rss', enabled: true, priority: 6, urlTemplate: (t) => gnews(`${t} site:nasdaq.com when:3d`) },
  { id: 'investing', name: 'Investing.com', category: 'General market', type: 'rss', enabled: true, priority: 6, urlTemplate: (t) => gnews(`${t} site:investing.com when:3d`) },

  // ── Official government / regulator RSS ──
  { id: 'fed', name: 'Federal Reserve', category: 'Fed / rates', type: 'official', enabled: true, priority: 9, url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
  { id: 'bls', name: 'Bureau of Labor Statistics', category: 'Economy', type: 'official', enabled: true, priority: 8, url: 'https://www.bls.gov/feed/news_release/bls.rss' },
  { id: 'treasury', name: 'Treasury.gov', category: 'Economy', type: 'official', enabled: true, priority: 7, url: 'https://home.treasury.gov/rss/press.xml' },

  // ── Not machine-fetchable (paywall / no public RSS) → deep links only ──
  { id: 'bloomberg', name: 'Bloomberg', category: 'General market', type: 'external_search', enabled: true, priority: 7, urlTemplate: (t) => `https://www.bloomberg.com/search?query=${encodeURIComponent(t)}` },
  { id: 'tradingview', name: 'TradingView', category: 'Stock-specific', type: 'external_search', enabled: true, priority: 5, urlTemplate: (t) => `https://www.tradingview.com/symbols/${t}/news/` },
  { id: 'seeking_alpha', name: 'Seeking Alpha', category: 'Stock-specific', type: 'external_search', enabled: true, priority: 6, urlTemplate: (t) => `https://seekingalpha.com/symbol/${t}/news` },
  { id: 'tipranks', name: 'TipRanks', category: 'Analyst', type: 'external_search', enabled: true, priority: 5, urlTemplate: (t) => `https://www.tipranks.com/stocks/${t.toLowerCase()}/stock-news` },
  { id: 'finviz', name: 'Finviz', category: 'Stock-specific', type: 'external_search', enabled: true, priority: 5, urlTemplate: (t) => `https://finviz.com/quote.ashx?t=${t}` },
  { id: 'the_fly', name: 'The Fly', category: 'Analyst', type: 'external_search', enabled: true, priority: 5, urlTemplate: (t) => `https://thefly.com/news.php?symbol=${t}` },
  { id: 'earnings_whispers', name: 'Earnings Whispers', category: 'Earnings', type: 'external_search', enabled: true, priority: 5, urlTemplate: (t) => `https://www.earningswhispers.com/stocks/${t}` },
  { id: 'sec_edgar', name: 'SEC EDGAR', category: 'Official Filings', type: 'external_search', enabled: true, priority: 8, urlTemplate: (t) => `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(t)}&type=&dateb=&owner=include&count=40` },
  { id: 'fred', name: 'FRED / St. Louis Fed', category: 'Economy', type: 'external_search', enabled: true, priority: 6, url: 'https://fred.stlouisfed.org/' },
  { id: 'bea', name: 'BEA', category: 'Economy', type: 'official', enabled: true, priority: 6, url: 'https://www.bea.gov/news/current-releases' },
  { id: 'forex_factory', name: 'Forex Factory', category: 'Economic calendar', type: 'external_search', enabled: true, priority: 6, url: 'https://www.forexfactory.com/calendar' },
];

/** Category market/macro feeds (not ticker-specific). */
export const CATEGORY_FEEDS: { category: NewsCategory; query: string }[] = [
  { category: 'General market', query: 'stock market S&P 500 Nasdaq Dow when:2d' },
  { category: 'Economy', query: 'US economy CPI inflation jobs report GDP when:3d' },
  { category: 'Fed / rates', query: 'Federal Reserve interest rates Powell rate decision when:3d' },
  { category: 'Earnings', query: 'earnings beat miss guidance results when:2d' },
  { category: 'Commodities', query: 'gold price OR oil price OR natural gas WTI Brent when:2d' },
  { category: 'Crypto', query: 'bitcoin OR crypto OR ethereum price when:2d' },
  { category: 'Trump / Tariffs', query: 'Trump tariffs trade war China export when:2d' },
  { category: 'FDA / Biotech', query: 'FDA approval OR drug OR biotech OR "clinical trial" when:3d' },
  { category: 'Semiconductors', query: 'semiconductor OR chip OR "AI chips" OR "export controls" when:2d' },
  { category: 'AI / Data Center', query: 'AI OR "data center" OR Nvidia OR capex when:2d' },
  { category: 'Energy / Utilities', query: '"nuclear power" OR "energy demand" OR utilities OR "power grid" when:3d' },
];

/** Sector keyword hints appended to ticker queries for relevance (requirement #5). */
export const SECTOR_KEYWORDS: Record<string, string> = {
  'FDA/Biotech': 'FDA OR "clinical trial" OR approval OR "phase 3" OR obesity',
  'Healthcare Distribution': 'earnings OR guidance OR distribution OR pharmacy',
  Semiconductors: '"AI chips" OR semiconductor OR "data center" OR "export controls"',
  'AI/Data Center': '"data center" OR AI OR capex OR cloud',
  'Energy/Utilities': '"nuclear power" OR "energy demand" OR "data center power" OR grid',
};
