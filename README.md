# Trump Trading — Real-Time Political Statement Market Alerts

Trump Trading is a real-time market-alert platform. It monitors **public statements by President Donald Trump** from official and public sources (Truth Social via licensed API access, White House feeds, press-conference transcripts, verified news APIs, RSS), analyzes each statement with AI for market relevance, and pushes instant alerts to traders via Firebase Cloud Messaging.

> **⚠️ DISCLAIMER — NOT FINANCIAL ADVICE**
> This application provides **informational alerts only**. It never recommends buying or selling any asset. AI analysis can be wrong, delayed, or incomplete. Always verify statements at the original source before making any trading decision. You are solely responsible for your trades.

## Repository layout

```
trump-trading/
├── backend/          # Node.js + TypeScript + Fastify API, ingestion workers, AI analysis, FCM dispatch
│   ├── src/
│   │   ├── config/       # env loading & validation
│   │   ├── db/           # pg pool, migration runner
│   │   ├── lib/          # jwt, errors, validation helpers
│   │   ├── modules/      # auth, users, alerts, watchlist, sources, prefs, admin, health
│   │   ├── ai/           # prompt system, Claude analyzer, rule-based fallback classifier
│   │   ├── ingestion/    # pluggable source adapters + dedupe + worker
│   │   ├── notifications/# FCM client + dispatcher (watchlist matching, quiet hours)
│   │   └── queue/        # BullMQ queues (Redis)
│   ├── migrations/   # SQL migrations
│   ├── seeds/        # seed data
│   └── tests/        # vitest unit + API tests
├── android/          # Kotlin + Jetpack Compose app (TrumpTrading)
└── docs/             # ARCHITECTURE.md, API.md, SETUP.md, DEPLOYMENT.md, LIMITATIONS.md
```

## Quick start

1. **Backend**: see [docs/SETUP.md](docs/SETUP.md) — `cd backend && npm install && npm run migrate && npm run dev`
2. **Android**: open `android/` in Android Studio, add your `google-services.json`, run.
3. **Docs**: [Architecture](docs/ARCHITECTURE.md) · [API reference](docs/API.md) · [Deployment](docs/DEPLOYMENT.md) · [Known limitations](docs/LIMITATIONS.md)

## Key product principles

- **No financial advice.** Alerts describe *possible* impact scenarios, never instructions.
- **No fabrication.** Every alert links to its original source URL and timestamp. Unconfirmed reports are clearly labeled.
- **Legal data access only.** Adapters use official APIs, RSS, and licensed feeds. No ToS-violating scraping.
- **Source reliability scoring.** Critical alerts are only sent from high-reliability sources or after cross-source confirmation.

## Known limitations (summary)

- True second-by-second monitoring depends on the legal availability and latency of each upstream source; some platforms do not offer real-time APIs.
- Alerts can be delayed by upstream API speed, polling intervals, and FCM delivery.
- AI classification can be wrong — risk levels and ticker lists are estimates, not facts.

See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for the full list.
