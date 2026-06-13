import type { SourceAdapter } from './types.js';
import { createRssAdapter } from './rssAdapter.js';
import { truthSocialAdapter } from './truthSocialAdapter.js';
import { newsApiAdapter } from './newsApiAdapter.js';

const GN = 'https://news.google.com/rss/search';

/**
 * Adapter registry. Each adapter's `key` must match a row in `sources`.
 * Runtime enable/disable is controlled by sources.enabled (admin API).
 * All URLs below were verified reachable; see docs/SOURCES.md for the audit.
 *
 * Adding a source: implement SourceAdapter, register here, insert a `sources` row.
 */
export const adapters: SourceAdapter[] = [
  // ── Primary: Trump's official public account (keyless Mastodon read) ──
  truthSocialAdapter,

  // ── Official government feeds ──
  createRssAdapter('whitehouse_news', 'https://www.whitehouse.gov/news/feed/', 'gov_feed'),
  createRssAdapter('whitehouse_actions', 'https://www.whitehouse.gov/presidential-actions/feed/', 'gov_feed'),

  // ── News aggregators (legal Google News RSS; AP/Reuters direct RSS retired) ──
  createRssAdapter(
    'googlenews_trump',
    `${GN}?q=${encodeURIComponent('Trump when:1d')}&hl=en-US&gl=US&ceid=US:en`,
  ),
  createRssAdapter(
    'ap_googlenews',
    `${GN}?q=${encodeURIComponent('Trump site:apnews.com when:2d')}&hl=en-US&gl=US&ceid=US:en`,
  ),

  // ── Financial press (catch market-framed Trump coverage) ──
  createRssAdapter('cnbc_top', 'https://www.cnbc.com/id/100003114/device/rss/rss.html'),
  createRssAdapter('cnbc_economy', 'https://www.cnbc.com/id/20910258/device/rss/rss.html'),
  createRssAdapter('marketwatch', 'https://feeds.content.dowjones.io/public/rss/mw_topstories'),
  createRssAdapter(
    'yahoo_finance',
    'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US',
  ),

  // ── Delayed transcript / public-remarks monitoring (NOT live) ──
  createRssAdapter(
    'transcripts_googlenews',
    `${GN}?q=${encodeURIComponent('Trump (remarks OR transcript OR "press conference") when:2d')}&hl=en-US&gl=US&ceid=US:en`,
    'transcript',
    { meta: { monitoring: 'delayed-transcript', note: 'Delayed transcript/remarks monitoring — not live.' } },
  ),

  // ── Requires API key (surfaced as "requires key", seeded disabled) ──
  newsApiAdapter,
];

export const adapterByKey = new Map(adapters.map((a) => [a.key, a]));
