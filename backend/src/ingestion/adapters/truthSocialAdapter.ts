import { env } from '../../config/env.js';
import type { SourceAdapter } from './types.js';
import type { IncomingStatement } from '../../lib/types.js';

/**
 * Truth Social adapter.
 *
 * IMPORTANT — legal access only:
 * Truth Social does not currently offer a general public API. This adapter is
 * a documented integration point for LICENSED access (e.g. a commercial data
 * provider that redistributes posts legally, or an official API if one becomes
 * available). It is disabled unless TRUTH_SOCIAL_API_KEY is configured AND the
 * source row is enabled by an admin. Do NOT point this at scraping endpoints
 * that violate Truth Social's terms of service.
 *
 * Expected provider response shape (adjust to your licensed provider):
 *   GET {BASE}/v1/accounts/realDonaldTrump/statuses?since=ISO8601
 *   [{ "id": "...", "text": "...", "url": "...", "created_at": "..." }]
 */
const PROVIDER_BASE = process.env.TRUTH_SOCIAL_PROVIDER_BASE ?? '';

export const truthSocialAdapter: SourceAdapter = {
  key: 'truth_social',
  type: 'truth_social',
  async fetchLatest(since: Date): Promise<IncomingStatement[]> {
    if (!env.TRUTH_SOCIAL_API_KEY || !PROVIDER_BASE) return [];
    const res = await fetch(
      `${PROVIDER_BASE}/v1/accounts/realDonaldTrump/statuses?since=${encodeURIComponent(since.toISOString())}`,
      { headers: { Authorization: `Bearer ${env.TRUTH_SOCIAL_API_KEY}` }, signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) throw new Error(`truth_social provider ${res.status}`);
    const posts = (await res.json()) as Array<{ id: string; text: string; url: string; created_at: string }>;
    return posts.map((p) => ({
      externalId: p.id,
      content: p.text,
      sourceUrl: p.url,
      statedAt: new Date(p.created_at),
      metadata: { platform: 'truth_social' },
    }));
  },
};
