import Parser from 'rss-parser';
import type { SourceAdapter } from './types.js';
import type { IncomingStatement, SourceType } from '../../lib/types.js';

const parser = new Parser({ timeout: 15_000 });

/** Mentions of Trump statements in trusted RSS feeds (Reuters, AP, White House). */
export function createRssAdapter(key: string, feedUrl: string, type: SourceType = 'rss'): SourceAdapter {
  return {
    key,
    type,
    async fetchLatest(since: Date): Promise<IncomingStatement[]> {
      const feed = await parser.parseURL(feedUrl);
      const out: IncomingStatement[] = [];
      for (const item of feed.items ?? []) {
        const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();
        if (publishedAt <= since) continue;
        const text = [item.title, item.contentSnippet].filter(Boolean).join(' — ');
        // Only ingest items actually about Trump statements; RSS feeds carry everything.
        if (!/\btrump\b/i.test(text)) continue;
        out.push({
          externalId: item.guid ?? item.link ?? undefined,
          content: text,
          sourceUrl: item.link ?? feedUrl,
          statedAt: publishedAt,
          metadata: { feedTitle: feed.title },
        });
      }
      return out;
    },
  };
}
