import type { SourceAdapter } from './types.js';
import { createRssAdapter } from './rssAdapter.js';
import { truthSocialAdapter } from './truthSocialAdapter.js';
import { newsApiAdapter } from './newsApiAdapter.js';

/**
 * Adapter registry. Adding a data source:
 *   1. create an adapter file implementing SourceAdapter
 *   2. register it here
 *   3. insert a matching row in `sources` (same `key`)
 * Enabling/disabling at runtime is controlled by sources.enabled (admin API).
 */
export const adapters: SourceAdapter[] = [
  truthSocialAdapter,
  newsApiAdapter,
  createRssAdapter('whitehouse_news', 'https://www.whitehouse.gov/news/feed/', 'gov_feed'),
  createRssAdapter('reuters_politics', 'https://www.reutersagency.com/feed/?best-topics=political-general'),
  createRssAdapter('ap_politics', 'https://rsshub.app/ap/topics/politics'),
];

export const adapterByKey = new Map(adapters.map((a) => [a.key, a]));
