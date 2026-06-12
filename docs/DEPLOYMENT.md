# Deployment Guide

The backend is a stateless Node app + three workers, PostgreSQL, and Redis. It ships with a Dockerfile, so any container host works. Recommended: **Railway** or **Render** (managed Postgres + Redis in the same project), or **Fly.io**.

## Shared steps (all hosts)

1. Provision PostgreSQL and Redis; note `DATABASE_URL` and `REDIS_URL`.
2. Set environment variables from `backend/.env.example` (generate long random JWT secrets: `openssl rand -base64 48`).
3. Upload the Firebase service-account JSON as a secret file (or base64 env var you write to disk at boot) and point `FIREBASE_SERVICE_ACCOUNT_PATH` at it.
4. Run migrations once per deploy: `npm run migrate` (add it as a release/pre-deploy command).
5. Deploy **4 processes** from the same image:
   - web: `node dist/index.js`
   - worker: `npx tsx src/ingestion/worker.ts` (or compile and run `dist/ingestion/worker.js`)
   - worker: `dist/ai/worker.js`
   - worker: `dist/notifications/worker.js`

## Render

- New → Blueprint or Web Service from repo, root `backend/`, environment **Docker**.
- Add a **PostgreSQL** and a **Key Value (Redis)** instance; copy internal URLs into env vars.
- Pre-deploy command: `node dist/db/migrate.js` *(compile includes migrate via `npm run build`)*.
- Add three **Background Workers** using the same repo/image with the worker start commands above.

## Railway

- New project → Deploy from GitHub repo (`backend/`). Railway auto-detects the Dockerfile.
- Add Postgres and Redis plugins; reference `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}`.
- Duplicate the service 3× and override each start command for the workers.

## Fly.io

```bash
cd backend
fly launch --no-deploy            # creates fly.toml
fly postgres create && fly postgres attach
fly redis create                  # Upstash Redis, sets REDIS_URL
fly secrets set JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... ANTHROPIC_API_KEY=...
fly deploy
```
Define worker processes in `fly.toml`:
```toml
[processes]
  app = "node dist/index.js"
  ingest = "node dist/ingestion/worker.js"
  analyze = "node dist/ai/worker.js"
  notify = "node dist/notifications/worker.js"
```

## Production checklist

- [ ] HTTPS only (all listed hosts terminate TLS for you); Android release build refuses cleartext.
- [ ] Rotate the seeded admin/demo passwords or delete those users.
- [ ] Set `MIN_RELIABILITY_FOR_CRITICAL` (default 80) after reviewing your enabled sources.
- [ ] Enable only sources you have legal API access to (`sources.enabled`).
- [ ] Point the Android release `API_BASE_URL` at your deployed host and ship via Play Console (internal testing → production).
- [ ] Publish a real privacy policy before store submission (placeholder lives at `/legal/disclaimer`).
