# Deploy Trump Trading — Free / No-Credit-Card

The web dashboard is served **by the backend** (same origin), so you deploy
**one** service. Redis is optional — the app runs fine on Postgres alone, which
is what makes a truly free, no-card deploy possible.

---

## Cheapest deployment plans (ranked)

### 1. Best free / no-card  →  Koyeb + Neon  (recommended)
| Piece | Provider | Card? | Notes |
|---|---|---|---|
| Backend + web | **Koyeb** free "nano" instance | **No card** | 1 free service, sleeps when idle |
| PostgreSQL | **Neon** free | **No card** | 0.5 GB, autosuspends |
| Redis | **none** | — | Run Redis-free (`REDIS_URL` unset) |
**Cost: $0.** No credit card anywhere. This is the target.

### 2. Best free-with-card  →  Render or Railway + Neon
| Piece | Provider | Card? |
|---|---|---|
| Backend + web | Render / Railway free web | **Card required** (identity check, no charge) |
| PostgreSQL | Neon free or the provider's free PG | varies |
Use this only if Koyeb's free instance is unavailable in your region.

### 3. Cheapest paid reliable  →  Railway Hobby or Fly.io
~**$5/mo** Railway Hobby (no sleep, includes usage) or Fly.io shared-cpu-1x.
Add this only when you want zero cold-starts.

---

## A. Database — Neon (free, no card)

1. Go to https://neon.tech → sign up (GitHub login, no card).
2. **Create project** → name `trump-trading` → region closest to you.
3. Copy the **connection string** (it looks like
   `postgresql://USER:PASS@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`).
   Keep the `?sslmode=require` — the backend auto-enables TLS for Neon.

> Alternative: **Supabase** (https://supabase.com, free, no card) → Project →
> Settings → Database → "Connection string" (URI). Append `?sslmode=require`.

## B. (Optional) Redis — Upstash (free, no card)

You do **not** need Redis. Skip this for the leanest free deploy. If you want it
for cross-instance dedupe caching later:
1. https://upstash.com → sign up (no card) → Create Database (Global).
2. Copy the **`rediss://`** URL → set as `REDIS_URL`. (TLS is auto-detected.)

> Note: leaving `REDIS_URL` unset keeps Redis usage at zero, which is why the
> free stack stays within quota. Dedupe still works (DB exact-hash + pg_trgm).

## C. Backend + web — Koyeb (free, no card)

### Option 1 — Dashboard (easiest)
1. https://www.koyeb.com → sign up (GitHub, no card).
2. **Create Service** → **GitHub** → pick `2569578shm-cyberandrewbob/trump-tradingg`.
3. **Builder:** Dockerfile. **Work directory:** `backend`. **Dockerfile:** `Dockerfile`.
4. **Instance:** Free. **Region:** Frankfurt (`fra`). **Port:** `8080` (HTTP).
5. **Health check:** HTTP path `/health` on port `8080`.
6. **Environment variables** (mark secrets as secret):
   ```
   PORT=8080
   NODE_ENV=production
   RUN_SCHEDULER=true
   FREE_TIER_MODE=true
   DATABASE_URL=<your Neon connection string>
   JWT_ACCESS_SECRET=<run: openssl rand -hex 32>
   JWT_REFRESH_SECRET=<run: openssl rand -hex 32>
   # REDIS_URL   ← leave UNSET for Redis-free
   # ANTHROPIC_API_KEY=<optional; else the rules classifier is used>
   ```
7. **Deploy.** The container runs migrations + seed, then starts the API +
   in-process scheduler. First build ~3 min.
8. Open `https://<your-app>.koyeb.app/` → the dashboard. Check
   `https://<your-app>.koyeb.app/health` → `{"ok":true,...,"redis":"disabled"}`.

### Option 2 — Koyeb CLI
See `backend/koyeb.yaml` for the exact `koyeb service create` command.

## D. Fallback — Railway (needs a card)

1. https://railway.app → New Project → Deploy from GitHub → `trump-tradingg`.
2. **Settings → Root Directory:** `backend` (so `backend/railway.json` + Dockerfile are used).
3. **Variables:** same as the Koyeb list above.
4. Add a Railway **Postgres** plugin (or use your Neon URL) → set `DATABASE_URL`.
5. Railway reads `backend/railway.json` (Dockerfile build, health check `/health`).

---

## Environment variables (reference)

| Var | Required | Value |
|---|---|---|
| `PORT` | yes | `8080` |
| `NODE_ENV` | yes | `production` |
| `RUN_SCHEDULER` | yes | `true` (runs ingestion+analysis in-process) |
| `FREE_TIER_MODE` | rec. | `true` (10-min polling, 5 DB conns, Redis-free defaults) |
| `DATABASE_URL` | yes | Neon/Supabase URL with `?sslmode=require` |
| `JWT_ACCESS_SECRET` | yes | 32+ random chars |
| `JWT_REFRESH_SECRET` | yes | 32+ random chars (different) |
| `REDIS_URL` | no | leave unset for Redis-free; or an Upstash `rediss://` URL |
| `ANTHROPIC_API_KEY` | no | enables AI analysis; otherwise rules classifier |

`FREE_TIER_MODE=true` effects: scheduler every 600 s, per-source minimum 10-min
gap, Postgres pool capped at 5, no aggressive behavior — keeps free quotas safe.

---

## Verify locally before deploying

```bash
cd backend
npm run build          # TypeScript compile
npm run test:web       # web dashboard build check
# with a local Postgres in DATABASE_URL (Redis optional):
npm run test:sources   # polls every source, prints PASS/FAIL + HTTP + items
npm run test:backend   # API/smoke tests (set RUN_API_TESTS=1)
npm run dev            # http://localhost:8080  (serves the dashboard)
```

Redis-free local run (proven working):
```bash
DATABASE_URL=postgres://... REDIS_URL=disabled FREE_TIER_MODE=true \
RUN_SCHEDULER=true JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... \
node dist/index.js
# GET /health → {"ok":true,"checks":{"db":"ok","redis":"disabled"}}
```

---

## Local dev with Docker Compose (Postgres + Redis)

```bash
docker compose up -d          # from repo root: Postgres :5432 + Redis :6379
cd backend && npm run dev
```
(For deployment you don't need Docker Compose — Koyeb builds the Dockerfile.)
