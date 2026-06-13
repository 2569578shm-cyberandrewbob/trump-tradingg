import { env } from '../../config/env.js';
import { htmlToText } from '../../lib/html.js';
import { curlGet } from '../../lib/curlFetch.js';
import type { IncomingStatement } from '../../lib/types.js';
import { type SourceAdapter, type FetchOutcome, FetchError } from './types.js';

/**
 * Truth Social adapter — Donald J. Trump's official public account.
 *
 * Truth Social runs on a Mastodon-compatible API whose read endpoints for
 * PUBLIC posts are reachable without authentication:
 *   - account lookup : GET /api/v1/accounts/lookup?acct=realDonaldTrump
 *   - public posts   : GET /api/v1/accounts/{id}/statuses
 * We only read public posts of the official account. No login, no scraping of
 * private/HTML pages, no ToS-violating endpoints. A licensed commercial
 * provider can be substituted by setting TRUTH_SOCIAL_PROVIDER_BASE +
 * TRUTH_SOCIAL_API_KEY (same response shape).
 *
 * If the public API blocks the request (Cloudflare / rate limit / geo), the
 * adapter throws FetchError with the exact HTTP status and body — it is never
 * silently disabled.
 */
const ACCT = 'realDonaldTrump';
const DEFAULT_BASE = 'https://truthsocial.com';
const ACCOUNT_ID = '107780257626128497'; // realDonaldTrump (stable); re-resolved if lookup succeeds

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

function base(): string {
  return process.env.TRUTH_SOCIAL_PROVIDER_BASE || DEFAULT_BASE;
}

function authHeaders(): Record<string, string> {
  // Public read needs no auth; a licensed provider key is attached if present.
  return env.TRUTH_SOCIAL_API_KEY
    ? { ...BROWSER_HEADERS, Authorization: `Bearer ${env.TRUTH_SOCIAL_API_KEY}` }
    : BROWSER_HEADERS;
}

const usingPublicHost = (): boolean => !process.env.TRUTH_SOCIAL_PROVIDER_BASE;

/**
 * GET returning { status, body }. Public truthsocial.com is fetched via system
 * curl (Cloudflare 403s Node's TLS fingerprint; see lib/curlFetch). A licensed
 * provider base uses standard fetch.
 */
async function get(url: string, timeoutMs = 20_000): Promise<{ status: number; body: string }> {
  if (usingPublicHost()) return curlGet(url, authHeaders(), timeoutMs);
  const res = await fetch(url, { headers: authHeaders(), signal: AbortSignal.timeout(timeoutMs) });
  return { status: res.status, body: await res.text() };
}

interface TsAccount {
  acct: string;
  display_name: string;
}
interface TsMedia {
  type: string; // image | video | gifv | audio
}
interface TsStatus {
  id: string;
  created_at: string;
  url: string;
  uri: string;
  content: string; // HTML
  language: string | null;
  account: TsAccount;
  media_attachments: TsMedia[];
  reblog: unknown | null;
}

/** Resolve the numeric account id (best-effort; falls back to the known id). */
async function resolveAccountId(): Promise<string> {
  try {
    const { status, body } = await get(`${base()}/api/v1/accounts/lookup?acct=${ACCT}`, 15_000);
    if (status === 200) {
      const acc = JSON.parse(body) as { id?: string };
      if (acc.id) return acc.id;
    }
  } catch {
    /* fall through to known id */
  }
  return process.env.TRUTH_SOCIAL_ACCOUNT_ID || ACCOUNT_ID;
}

export const truthSocialAdapter: SourceAdapter = {
  key: 'truth_social',
  type: 'truth_social',
  requiresKey: false, // public read works keyless; key only for licensed providers

  async fetchLatest(since: Date): Promise<FetchOutcome> {
    const accountId = await resolveAccountId();
    const url =
      `${base()}/api/v1/accounts/${accountId}/statuses` +
      `?exclude_replies=true&exclude_reblogs=true&only_media=false&limit=40`;

    const { status, body } = await get(url, 20_000);
    if (status !== 200) {
      throw new FetchError(`truth_social HTTP ${status}`, status, body.slice(0, 500));
    }

    const posts = JSON.parse(body) as TsStatus[];
    const items: IncomingStatement[] = [];
    let mediaOnly = 0;

    for (const p of posts) {
      if (p.reblog) continue; // safety: skip reblogs even if the param is ignored
      const statedAt = new Date(p.created_at);
      if (statedAt <= since) continue;

      const text = htmlToText(p.content);
      const mediaTypes = p.media_attachments.map((m) => m.type);
      if (!text) {
        // Media-only post (video/image, no caption) — nothing textual to analyze.
        mediaOnly += 1;
        continue;
      }

      items.push({
        externalId: p.id,
        content: text,
        sourceUrl: p.url || p.uri,
        statedAt,
        metadata: {
          platform: 'truth_social',
          account: p.account?.acct ?? ACCT,
          author: p.account?.display_name ?? 'Donald J. Trump',
          language: p.language,
          hasMedia: mediaTypes.length > 0,
          mediaTypes,
        },
      });
    }

    return {
      items,
      httpStatus: status,
      fetchedCount: posts.length,
      note: mediaOnly ? `media-only posts skipped: ${mediaOnly}` : undefined,
    };
  },
};
