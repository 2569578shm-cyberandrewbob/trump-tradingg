import { env } from '../../config/env.js';
import type { IncomingStatement } from '../../lib/types.js';
import { type SourceAdapter, type FetchOutcome, FetchError } from './types.js';

/**
 * NewsAPI.org adapter (official API, REQUIRES a key; respects their ToS/rate
 * limits). Marked requiresKey:true so the source dashboard shows "requires key"
 * instead of silently returning nothing. Aggregator content is lower-reliability.
 */
export const newsApiAdapter: SourceAdapter = {
  key: 'news_api',
  type: 'news_api',
  requiresKey: true,
  async fetchLatest(since: Date): Promise<FetchOutcome> {
    if (!env.NEWS_API_KEY) {
      throw new FetchError('news_api requires NEWS_API_KEY (not configured)', null);
    }
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
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new FetchError(`news_api HTTP ${res.status}`, res.status, body.slice(0, 500));
    }
    const body = (await res.json()) as {
      articles: Array<{ title: string; description: string | null; url: string; publishedAt: string; source: { name: string } }>;
    };
    const items: IncomingStatement[] = (body.articles ?? []).map((a) => ({
      content: [a.title, a.description].filter(Boolean).join(' — '),
      sourceUrl: a.url,
      statedAt: new Date(a.publishedAt),
      metadata: { outlet: a.source.name, aggregator: 'newsapi' },
    }));
    return { items, httpStatus: res.status, fetchedCount: body.articles?.length ?? 0 };
  },
};
