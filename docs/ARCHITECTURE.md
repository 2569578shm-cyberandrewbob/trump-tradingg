# Architecture

## High-level flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA SOURCES                               │
│  Truth Social API (licensed) · White House RSS · Press transcripts  │
│  News APIs (NewsAPI/GDELT) · Trusted RSS feeds                      │
└───────────────┬─────────────────────────────────────────────────────┘
                │ pluggable SourceAdapter interface (poll / webhook / RSS)
                ▼
┌──────────────────────────┐    Redis (BullMQ)    ┌──────────────────┐
│   Ingestion Worker        │ ───── enqueue ─────▶ │  Analysis Worker │
│ - fetch per-source cadence│                      │ - AI prompt (LLM)│
│ - normalize → RawStatement│                      │ - JSON validation│
│ - dedupe (hash+fuzzy)     │                      │ - rule fallback  │
│ - store raw_statements    │                      │ - store alert    │
└──────────────────────────┘                      └────────┬─────────┘
                                                            │ market-relevant?
                                                            ▼
┌──────────────────────────┐                      ┌──────────────────┐
│  PostgreSQL               │ ◀──────────────────  │ Notification     │
│  users, alerts, sources,  │                      │ Dispatcher       │
│  watchlists, prefs, logs  │                      │ - prefs filter   │
└────────────┬─────────────┘                      │ - watchlist match│
             │ REST (Fastify)                      │ - quiet hours    │
             ▼                                     │ - FCM send       │
┌──────────────────────────┐                      └──────────────────┘
│  Android app (Compose)    │ ◀──── FCM push ──────────────┘
└──────────────────────────┘
```

## Backend components

| Component | Tech | Responsibility |
|---|---|---|
| API server | Fastify + TypeScript | REST API for the Android app and admin panel |
| Ingestion worker | Node process + BullMQ repeatable jobs | Polls each enabled source on its own cadence, normalizes and dedupes statements |
| Analysis worker | BullMQ consumer | Runs the AI prompt (Claude API), validates JSON output, falls back to rule-based classifier |
| Notification dispatcher | BullMQ consumer | Resolves audience (prefs, watchlist, quiet hours) and sends FCM messages |
| PostgreSQL | pg | System of record |
| Redis | ioredis + BullMQ | Job queues, dedupe cache, rate-limit counters |
| Firebase Admin SDK | firebase-admin | FCM push delivery |

### Pluggable source adapters

Every source implements:

```ts
interface SourceAdapter {
  readonly key: string;              // unique, matches sources.key in DB
  readonly type: SourceType;         // 'truth_social' | 'rss' | 'news_api' | 'transcript' | 'gov_feed'
  fetchLatest(since: Date): Promise<IncomingStatement[]>;
}
```

Adapters are registered in `src/ingestion/adapters/index.ts`. Adding a source = one new file + one DB row. Disabling a source = flipping `sources.enabled` (admin API) — the worker skips disabled sources on the next cycle. **No adapter scrapes pages in violation of ToS**; sources without legal API access ship as documented stubs behind an env flag.

### Deduplication strategy (3 layers)

1. **Exact**: SHA-256 of normalized text (lowercased, whitespace/punctuation collapsed) — unique index on `raw_statements.content_hash`.
2. **Cross-source near-duplicate**: trigram similarity (`pg_trgm`, threshold 0.85) against statements from the last 6 hours.
3. **Redis hot cache**: recent hashes kept 6h for a fast pre-DB check.

A near-duplicate from a *second independent source* is not discarded silently — it increments `confirmation_count` on the original, which can upgrade an "unconfirmed" alert to "confirmed".

### False-alert safeguards

- Per-source `reliability_score` (0–100), adjustable via admin API and nightly recomputed from correction history.
- Critical/High alerts require `reliability_score ≥ 80` **or** `confirmation_count ≥ 2`; otherwise the alert is published as **UNCONFIRMED** and capped at Medium for notification purposes.
- AI output failing schema validation → rule-based fallback classifier; nothing is fabricated, the original text is always stored verbatim with its source URL and timestamp.
- Admins can correct category/risk and resend or retract notifications; corrections feed reliability scoring.

## Android app

- **Stack**: Kotlin, Jetpack Compose, Material 3 (dark trading theme), Hilt DI, Retrofit/OkHttp, kotlinx.serialization, DataStore, Navigation Compose, Firebase Messaging.
- **Pattern**: MVVM — `Screen (Compose) → ViewModel (StateFlow) → Repository → ApiService/DataStore`.
- **Screens**: Splash, Login/Signup, Dashboard (risk meter, top sectors/tickers, category filters, timeline), Alerts feed, Alert detail, Watchlist, Settings, Notification preferences, Source reliability, Disclaimer.
- **Push**: `TrumpFcmService` receives data messages, renders channel-per-risk-level notifications (critical bypasses default importance), deep-links to the alert detail screen.

## Security

- JWT auth (access 15 min + refresh 30 days, rotated), bcrypt password hashing.
- Zod validation on every API input; central error handler never leaks internals.
- Rate limiting (per-IP and per-user) via `@fastify/rate-limit` backed by Redis.
- All secrets via environment variables (`.env.example` provided, nothing hardcoded).
- FCM device tokens stored server-side, scoped per user, deleted on logout.
- Admin endpoints require `role = 'admin'` claim.
