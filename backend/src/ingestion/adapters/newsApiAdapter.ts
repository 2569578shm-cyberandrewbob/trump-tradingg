import { env } from '../../config/env.js';
import type { SourceAdapter } from './types.js';
import type { IncomingStatement } from '../../lib/types.js';

/**
 * NewsAPI.org adapter (official API, requires key; respects their ToS/rate limits).
 * Aggregator content is treated as lower-reliability — see source_reliability seeding.
 */
export const newsApiAdapter: SourceAdapter = {
  key: 'news_api',
  type: 'news_api',
  async fetchLatest(since: Date): Promise<IncomingStatement[]> {
    if (!env.NEWS_API_KEY) return [];
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', '"Trump" AND (statement OR says OR announces OR tariff OR sanctions)');
    url.searchParams.set('from', since.toISOString());
    url.searchParams.set('language', 'en');
    url.searchParams.set('sortBy', 'publishedAt');
    url.searchParams.set('pageSize', '25');
    const res = await fetch(url, {
      headers: { 'X-Api-Key': env.NEWS_API_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`news_api ${res.status}`);
    const body = (await res.json()) as {
      articles: Array<{ title: string; description: string | null; url: string; publishedAt: string; source: { name: string } }>;
    };
    return (body.articles ?? []).map((a) => ({
      content: [a.title, a.description].filter(Boolean).join(' — '),
      sourceUrl: a.url,
      statedAt: new Date(a.publishedAt),
      metadata: { outlet: a.source.name, aggregator: 'newsapi' },
    }));
  },
};
