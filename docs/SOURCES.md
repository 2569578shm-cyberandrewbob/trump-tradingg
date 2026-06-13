# Data Sources — Reachability Audit & Ingestion

Audited live on **2026-06-13** from a residential connection. Each row was hit
with a real HTTP request; statuses below are what the backend actually received.

## Enabled (working, keyless)

| Source key | What | Access | Status | Notes |
|---|---|---|---|---|
| `truth_social` | Trump's official account `@realDonaldTrump` | Mastodon public API, **via system `curl`** | 200 | Cloudflare 403s Node's `fetch` regardless of headers; `curl` is served 200 on the same public, no-auth endpoint. See `src/lib/curlFetch.ts`. |
| `whitehouse_news` | White House news & releases | RSS | 200 | Official government feed. |
| `whitehouse_actions` | White House presidential actions | RSS | 200 | Official government feed. |
| `googlenews_trump` | Google News — "Trump" | RSS | 200 | Legal aggregator; high Trump-item volume. |
| `ap_googlenews` | AP coverage of Trump | Google News RSS (`site:apnews.com`) | 200 | AP's direct public RSS was retired; surfaced via Google News. |
| `cnbc_top`, `cnbc_economy` | CNBC markets | RSS | 200 | Market-framed coverage. |
| `marketwatch` | MarketWatch top stories | RSS (Dow Jones feed) | 200 | Canonical URL `feeds.content.dowjones.io`. |
| `yahoo_finance` | Yahoo Finance headlines | RSS | 200 | Filtered to Trump mentions. |
| `transcripts_googlenews` | Trump remarks / transcripts | Google News RSS | 200 | **Delayed transcript monitoring — not live.** |

## Disabled (documented, never silently skipped)

| Source key | Why disabled | What's needed |
|---|---|---|
| `news_api` | Requires an API key | Set `NEWS_API_KEY`; flagged `requiresKey: true` and shown as such in `GET /sources`. |
| `reuters_rss` | Reuters discontinued public RSS (HTTP 301 → empty) | A licensed **Reuters Connect** API subscription. |

## How Truth Social ingestion works (and its limits)

- Endpoints (public, unauthenticated reads):
  - `GET /api/v1/accounts/lookup?acct=realDonaldTrump`
  - `GET /api/v1/accounts/{id}/statuses?exclude_replies=true&exclude_reblogs=true&limit=40`
- We read **only** the official public account. No login, no private endpoints,
  no HTML scraping, no CAPTCHA/JS-challenge solving. `curl` simply isn't
  fingerprint-blocked the way Node's TLS stack is.
- **Risk / limitation:** Cloudflare can change its policy at any time and begin
  blocking `curl` too (the adapter then records the exact HTTP status/body in
  `source_health.last_error` and the alert is never fabricated). For a hardened
  production setup, use a **licensed redistribution provider** by setting
  `TRUTH_SOCIAL_PROVIDER_BASE` + `TRUTH_SOCIAL_API_KEY` (same response shape),
  which routes through `fetch` instead of `curl`.
- Media-only posts (video/image with no caption) carry no analyzable text and
  are skipped (counted in the poll log as `media-only posts skipped: N`).

## Dedupe

Three layers, in order: (1) same `(source_id, external_id)` post id, (2) exact
normalized-text SHA-256 (`content_hash`, globally unique), (3) `pg_trgm`
similarity ≥ `DEDUPE_SIMILARITY_THRESHOLD` within `DEDUPE_WINDOW_HOURS` — a
near-duplicate from a *different* source increments `confirmation_count`, which
can lift an alert from unconfirmed to confirmed.
