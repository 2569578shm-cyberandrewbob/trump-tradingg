import Parser from 'rss-parser';
import { htmlToText } from '../../lib/html.js';
import type { IncomingStatement, SourceType } from '../../lib/types.js';
import { type SourceAdapter, type FetchOutcome, FetchError } from './types.js';

const parser = new Parser({ timeout: 20_000 });

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface RssOptions {
  /** Only ingest items matching this pattern (default: mentions of Trump). */
  filter?: RegExp;
  /** Extra metadata merged into every statement (e.g. delayed-transcript label). */
  meta?: Record<string, unknown>;
}

/**
 * Generic RSS/Atom adapter. We fetch the feed ourselves (with a browser UA so
 * feeds that 403 the default agent succeed) to capture the exact HTTP status
 * for source-health reporting, then hand the body to rss-parser.
 */
export function createRssAdapter(
  key: string,
  feedUrl: string,
  type: SourceType = 'rss',
  options: RssOptions = {},
): SourceAdapter {
  const filter = options.filter ?? /\btrump\b/i;
  return {
    key,
    type,
    requiresKey: false,
    async fetchLatest(since: Date): Promise<FetchOutcome> {
      const res = await fetch(feedUrl, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.text().catch(() => '');
      if (!res.ok) {
        throw new FetchError(`${key} HTTP ${res.status} ${res.statusText}`, res.status, body.slice(0, 500));
      }

      const feed = await parser.parseString(body);
      const items: IncomingStatement[] = [];
      for (const item of feed.items ?? []) {
        const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();
        if (publishedAt <= since) continue;
        const raw = [item.title, item.contentSnippet].filter(Boolean).join(' — ');
        const text = htmlToText(raw);
        if (!text || !filter.test(text)) continue; // RSS feeds carry everything; keep only relevant items
        items.push({
          externalId: item.guid ?? item.link ?? undefined,
          content: text,
          sourceUrl: item.link ?? feedUrl,
          statedAt: publishedAt,
          metadata: { feedTitle: feed.title, ...options.meta },
        });
      }
      return { items, httpStatus: res.status, fetchedCount: feed.items?.length ?? 0 };
    },
  };
}
