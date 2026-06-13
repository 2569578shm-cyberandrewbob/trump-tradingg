import type { SourceAdapter } from './types.js';
import { createRssAdapter } from './rssAdapter.js';
import { truthSocialAdapter } from './truthSocialAdapter.js';
import { newsApiAdapter } from './newsApiAdapter.js';

const GN = 'https://news.google.com/rss/search';

/** Build a Google News RSS search URL (legal, keyless, reliable). */
function gn(q: string): string {
  return `${GN}?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
}

/** Keep everything the query already constrained (no extra filtering). */
const KEEP_ALL = /.*/;

/**
 * Broad financial/world feeds carry unrelated stories — keep only items that
 * touch a market-moving political theme.
 */
const MARKET_FILTER =
  /\b(trump|tariff|sanction|war|ceasefire|truce|oil|opec|crypto|bitcoin|fed|federal reserve|interest rate|rate cut|rate hike|dollar|inflation|china|russia|ukraine|iran|israel|gaza|middle east|nato|stocks?|equit|nasdaq|s&p|dow|market|trade war|nuclear|strike|missile|escalat)\b/i;

/** Google News search constrained to a specific publisher's domain. */
function gnSite(key: string, site: string, query = 'Trump', days = '2d'): SourceAdapter {
  return createRssAdapter(key, gn(`${query} site:${site} when:${days}`), 'rss', { filter: KEEP_ALL });
}

/**
 * Adapter registry. Each adapter's `key` must match a row in `sources`.
 * Grouping / official-vs-fallback labels live on the `sources` row
 * (source_group, source_kind) — see seeds/seed.sql.
 *
 * All news-search adapters use Google News RSS (keyless, legal, no scraping of
 * paywalled content). Direct RSS is used where a stable official/public feed
 * exists (White House, Federal Register, CNBC, MarketWatch, Yahoo Finance).
 */
export const adapters: SourceAdapter[] = [
  // ════════════════ TRUTH SOCIAL — DIRECT ════════════════
  // Keyless Mastodon read via system curl (Cloudflare blocks Node fetch).
  truthSocialAdapter,

  // ════════════════ TRUTH SOCIAL — VIA NEWS (clearly labeled "news report about Truth Social") ════════════════
  createRssAdapter('tsn_core',    gn('"Trump" "Truth Social" when:2d'),            'rss', { filter: KEEP_ALL, meta: { viaNews: true, label: 'News report about Truth Social' } }),
  createRssAdapter('tsn_markets', gn('Trump "Truth Social" (tariff OR oil OR crypto OR bitcoin OR stocks OR market OR Fed OR "interest rates" OR sanctions OR dollar) when:3d'), 'rss', { filter: KEEP_ALL, meta: { viaNews: true, label: 'News report about Truth Social' } }),
  createRssAdapter('tsn_geo',     gn('Trump "Truth Social" (war OR ceasefire OR Iran OR China OR Russia OR Ukraine OR Israel OR strike OR sanctions) when:3d'), 'rss', { filter: KEEP_ALL, meta: { viaNews: true, label: 'News report about Truth Social' } }),

  // ════════════════ OFFICIAL US GOVERNMENT ════════════════
  // Direct official RSS:
  createRssAdapter('whitehouse_news',     'https://www.whitehouse.gov/news/feed/',                 'gov_feed', { filter: KEEP_ALL }),
  createRssAdapter('whitehouse_briefing', 'https://www.whitehouse.gov/briefing-room/feed/',        'gov_feed', { filter: KEEP_ALL }),
  createRssAdapter('whitehouse_actions',  'https://www.whitehouse.gov/presidential-actions/feed/', 'gov_feed', { filter: KEEP_ALL }),
  createRssAdapter('whitehouse_remarks',  'https://www.whitehouse.gov/remarks/feed/',              'gov_feed', { filter: KEEP_ALL }),
  createRssAdapter('federal_register',    'https://www.federalregister.gov/api/v1/documents.rss?conditions%5Btype%5D%5B%5D=PRESDOCU&order=newest', 'gov_feed', { filter: KEEP_ALL }),
  // Official agency coverage via Google News site-search (reliable; labeled news_fallback):
  gnSite('treasury_press', 'home.treasury.gov', 'Treasury (sanctions OR tariff OR statement)', '3d'),
  gnSite('state_press',    'state.gov',         'State Department', '3d'),
  gnSite('defense_press',  'defense.gov',       'Defense Department', '3d'),
  gnSite('ustr_press',     'ustr.gov',          'USTR (tariff OR trade)', '4d'),
  gnSite('fed_press',      'federalreserve.gov','Federal Reserve', '4d'),

  // ════════════════ MARKET & FINANCIAL NEWS ════════════════
  // Direct RSS:
  createRssAdapter('cnbc_top',     'https://www.cnbc.com/id/100003114/device/rss/rss.html', 'rss', { filter: MARKET_FILTER }),
  createRssAdapter('cnbc_economy', 'https://www.cnbc.com/id/20910258/device/rss/rss.html',  'rss', { filter: MARKET_FILTER }),
  createRssAdapter('cnbc_markets', 'https://www.cnbc.com/id/15839135/device/rss/rss.html',  'rss', { filter: MARKET_FILTER }),
  createRssAdapter('marketwatch',  'https://feeds.content.dowjones.io/public/rss/mw_topstories', 'rss', { filter: MARKET_FILTER }),
  createRssAdapter('yahoo_finance','https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US', 'rss', { filter: MARKET_FILTER }),
  // Publisher site-search:
  gnSite('reuters_trump',     'reuters.com',          'Trump'),
  gnSite('cnbc_trump',        'cnbc.com',             'Trump'),
  gnSite('marketwatch_trump', 'marketwatch.com',      'Trump'),
  gnSite('yahoo_trump',       'finance.yahoo.com',    'Trump'),
  gnSite('investing_trump',   'investing.com',        'Trump (tariff OR oil OR crypto OR stocks)', '3d'),

  // ════════════════ GENERAL RELIABLE NEWS ════════════════
  createRssAdapter('ap_googlenews', gn('Trump site:apnews.com when:2d'), 'rss', { filter: KEEP_ALL }),
  gnSite('bbc_trump',      'bbc.com',            'Trump'),
  gnSite('cnn_trump',      'cnn.com',            'Trump'),
  gnSite('foxnews_trump',  'foxnews.com',        'Trump'),
  gnSite('guardian_trump', 'theguardian.com',    'Trump'),
  gnSite('politico_trump', 'politico.com',       'Trump'),
  gnSite('axios_trump',    'axios.com',          'Trump'),
  gnSite('thehill_trump',  'thehill.com',        'Trump'),
  gnSite('npr_trump',      'npr.org',            'Trump'),
  gnSite('cbs_trump',      'cbsnews.com',        'Trump'),
  gnSite('abc_trump',      'abcnews.go.com',     'Trump'),
  gnSite('nbc_trump',      'nbcnews.com',        'Trump'),
  gnSite('nyt_trump',      'nytimes.com',        'Trump'),
  gnSite('wapo_trump',     'washingtonpost.com', 'Trump'),

  // ════════════════ INTERNATIONAL / GEOPOLITICAL ════════════════
  gnSite('aljazeera_trump', 'aljazeera.com', 'Trump'),
  gnSite('france24_trump',  'france24.com',  'Trump'),
  gnSite('dw_trump',        'dw.com',        'Trump'),
  createRssAdapter('reuters_world', gn('(war OR ceasefire OR conflict OR sanctions OR strike) site:reuters.com when:1d'), 'rss', { filter: KEEP_ALL }),
  createRssAdapter('ap_world',      gn('(war OR ceasefire OR conflict OR sanctions OR strike) site:apnews.com when:1d'),  'rss', { filter: KEEP_ALL }),
  createRssAdapter('bbc_world',     gn('(war OR ceasefire OR conflict OR sanctions OR strike) site:bbc.com when:1d'),     'rss', { filter: KEEP_ALL }),
  createRssAdapter('un_news',       gn('United Nations (Security Council OR ceasefire OR conflict) when:2d'), 'rss', { filter: KEEP_ALL }),
  createRssAdapter('nato_news',     gn('NATO (statement OR Ukraine OR Russia OR defense) when:2d'),           'rss', { filter: KEEP_ALL }),
  createRssAdapter('kremlin_news',  gn('(Kremlin OR Putin) (statement OR Ukraine OR sanctions OR Trump) when:2d'), 'rss', { filter: KEEP_ALL }),
  createRssAdapter('ukraine_news',  gn('(Zelensky OR Ukraine government) (ceasefire OR Russia OR Trump OR aid) when:2d'), 'rss', { filter: KEEP_ALL }),
  createRssAdapter('israel_news',   gn('(Israel Prime Minister OR Netanyahu) (Gaza OR ceasefire OR Iran OR Trump) when:2d'), 'rss', { filter: KEEP_ALL }),
  createRssAdapter('iran_news',     gn('Iran (foreign ministry OR nuclear OR sanctions OR strike OR Trump) when:2d'), 'rss', { filter: KEEP_ALL }),

  // ════════════════ DELAYED TRANSCRIPTS ════════════════
  createRssAdapter('transcripts_googlenews', gn('Trump (remarks OR transcript OR "press conference") when:2d'), 'transcript',
    { filter: KEEP_ALL, meta: { monitoring: 'delayed-transcript', note: 'Delayed transcript/remarks monitoring — not live.' } }),

  // ════════════════ REQUIRES API KEY (seeded disabled) ════════════════
  newsApiAdapter,
];

export const adapterByKey = new Map(adapters.map((a) => [a.key, a]));
