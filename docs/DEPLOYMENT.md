# Deployment Guide — Trump Trading

This guide gets the backend running on a public HTTPS server so the Android app
works anywhere, from any phone, on any network.

---

## Architecture

```
Android App (your phone)
    │  HTTPS
    ▼
[Render / Railway / Fly.io]
    ├── Web API   (Fastify :8080)      ← handles all app requests
    ├── Ingest    (polls RSS/news)     ← runs every 2 min
    ├── Analyze   (AI classification) ← optional, rule-based fallback works
    └── Notify    (FCM push)          ← optional
    │
    ├── Postgres  (managed)
    └── Redis     (managed)
```

---

## Option A — Render (Recommended, Free Tier Available)

Render is the easiest: free managed Postgres + Redis, automatic HTTPS, auto-deploy from GitHub.

### Step 1 — Push to GitHub

```bash
cd "C:\Users\pc\Desktop\Downloads\sot 3araby\trump-trading"
git remote add origin https://github.com/YOUR_USERNAME/trump-trading.git
git push -u origin master
```

### Step 2 — Create Render account

Go to https://render.com and sign up (free).

### Step 3 — Deploy via render.yaml (one click)

1. In Render dashboard → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render reads `backend/render.yaml` automatically and creates:
   - `trump-trading-api`    (web service — your public HTTPS URL)
   - `trump-trading-ingest` (worker)
   - `trump-trading-db`     (Postgres)
   - `trump-trading-redis`  (Redis)
4. Click **Apply**

### Step 4 — Run database migrations

In the Render dashboard → `trump-trading-api` service → **Shell**:
```bash
npm run migrate
npm run seed
```

### Step 5 — Get your public URL

In Render dashboard → `trump-trading-api` → copy the URL, e.g.:
```
https://trump-trading-api.onrender.com
```

### Step 6 — Test the URL from your phone browser

Open on mobile data (Wi-Fi off):
```
https://trump-trading-api.onrender.com/health
```

Expected response:
```json
{
  "ok": true,
  "service": "trump-trading-backend",
  "status": "ok",
  "checks": { "db": "ok", "redis": "ok" },
  "time": "2026-06-13T..."
}
```

### Step 7 — Update the Android app

Open `android/gradle.properties` and set:
```properties
TRUMP_TRADING_API_URL=https://trump-trading-api.onrender.com/
```
(trailing slash required)

### Step 8 — Build and install the APK

```bash
cd android
.\gradlew.bat assembleDebug
```

APK will be at:
```
android\app\build\outputs\apk\debug\app-debug.apk
```

Install on your phone via USB:
```bash
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

Or copy the APK file to your phone and install manually (enable "Install unknown apps" in settings).

---

## Option B — Railway

Railway also provides free managed Postgres + Redis.

### Step 1 — Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### Step 2 — Create project

```bash
cd "C:\Users\pc\Desktop\Downloads\sot 3araby\trump-trading\backend"
railway init
railway add postgresql
railway add redis
```

### Step 3 — Set environment variables

```bash
railway variables set NODE_ENV=production
railway variables set PORT=8080
railway variables set JWT_ACCESS_SECRET=REPLACE_WITH_LONG_RANDOM_STRING_32_CHARS
railway variables set JWT_REFRESH_SECRET=REPLACE_WITH_DIFFERENT_LONG_RANDOM_STRING
railway variables set JWT_ACCESS_TTL=15m
railway variables set JWT_REFRESH_TTL=30d
railway variables set INGEST_POLL_SECONDS_DEFAULT=120
```

### Step 4 — Deploy

```bash
railway up
```

### Step 5 — Run migrations

```bash
railway run npm run migrate
railway run npm run seed
```

### Step 6 — Get your URL

```bash
railway open
```

Update `android/gradle.properties` with the Railway URL as shown in Step 7 of Option A.

---

## Option C — Fly.io

### Install Fly CLI and log in

```powershell
# Windows PowerShell
iwr https://fly.io/install.ps1 -useb | iex
fly auth login
```

### Launch the app

```bash
cd "C:\Users\pc\Desktop\Downloads\sot 3araby\trump-trading\backend"
fly launch --name trump-trading-api --region fra --no-deploy
```

### Create Postgres and Redis

```bash
fly postgres create --name trump-trading-db --region fra
fly postgres attach trump-trading-db
fly redis create --name trump-trading-redis --region fra
```

### Set secrets

```bash
fly secrets set JWT_ACCESS_SECRET=REPLACE_WITH_LONG_RANDOM_STRING
fly secrets set JWT_REFRESH_SECRET=REPLACE_WITH_DIFFERENT_LONG_RANDOM_STRING
```

### Deploy

```bash
fly deploy
```

### Run migrations

```bash
fly ssh console -C "node dist/db/migrate.js"
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `8080` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_ACCESS_SECRET` | Yes | Min 32 random chars |
| `JWT_REFRESH_SECRET` | Yes | Min 32 random chars, different from above |
| `JWT_ACCESS_TTL` | Yes | `15m` |
| `JWT_REFRESH_TTL` | Yes | `30d` |
| `NEWS_API_KEY` | Optional | newsapi.org key (free tier: 100 req/day) |
| `ANTHROPIC_API_KEY` | Optional | Claude AI — rule-based fallback used if absent |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional | FCM push notifications |
| `INGEST_POLL_SECONDS_DEFAULT` | Optional | Default: `120` |
| `DEDUPE_WINDOW_HOURS` | Optional | Default: `6` |
| `MIN_RELIABILITY_FOR_CRITICAL` | Optional | Default: `70` |

---

## After Deployment — Android Setup

### 1. Edit `android/gradle.properties`

```properties
TRUMP_TRADING_API_URL=https://YOUR-ACTUAL-URL.onrender.com/
```

### 2. Build debug APK

```bash
cd android
.\gradlew.bat clean assembleDebug
```

APK path: `android\app\build\outputs\apk\debug\app-debug.apk`

### 3. Install on phone

Copy APK to phone and open it, or:
```bash
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

---

## Verification Checklist

```
[ ] https://YOUR_URL/health  returns {"ok":true}  from browser on PC
[ ] https://YOUR_URL/health  returns {"ok":true}  from phone on mobile data (Wi-Fi off)
[ ] App opens directly to Dashboard (no login screen)
[ ] Dashboard loads without error
[ ] Live Alerts tab shows items (or "no alerts yet" if DB just started)
[ ] Settings → Diagnostics shows: backend reachable ✓, db: ok, redis: ok
[ ] No "CLEARTEXT" error in logcat
[ ] No "10.0.2.2" anywhere in any error
```

---

## Truth Social Status

**Truth Social does NOT have an official public real-time API.**

- The undocumented Mastodon endpoint responds to `curl` but Cloudflare blocks
  Node.js `fetch()` with HTTP 403 due to TLS fingerprinting.
- The backend uses `curlFetch.ts` to shell out to system `curl` as a workaround.
  This works on all cloud servers (Render/Railway/Fly.io all have curl).
- This endpoint is unofficial and may be removed at any time by Truth Social.
- All other sources work without API keys: Google News RSS, White House feeds,
  CNBC, MarketWatch, AP, Yahoo Finance.

---

## Local Development (laptop only)

```bash
# Postgres runs at localhost:5433, Redis at localhost:6380 (portable binaries)

cd backend
npm run dev             # API on :8080
# in separate terminals:
npm run worker:ingest
npm run worker:analyze
```

Test locally:
```bash
curl http://localhost:8080/health
curl http://localhost:8080/alerts
```
