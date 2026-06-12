# API Reference

Base URL: `http://localhost:8080` (dev) · All responses are JSON. Errors: `{ "error": "CODE", "message": "..." }`.
Auth: `Authorization: Bearer <accessToken>` on all endpoints except `/auth/register`, `/auth/login`, `/auth/refresh`, `/health`, `/legal/disclaimer`.
Rate limits: 120 req/min per user/IP; register 5/min; login 10/min.

## Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{email, password (≥8), displayName?}` | `201 {userId, accessToken, refreshToken}` |
| POST | `/auth/login` | `{email, password}` | `{userId, role, displayName, accessToken, refreshToken}` |
| POST | `/auth/refresh` | `{refreshToken}` | new token pair (old refresh token is revoked — rotation) |
| POST | `/auth/fcm-token` | `{token}` | registers an FCM device token for push |
| POST | `/auth/logout` | `{fcmToken?}` | revokes refresh tokens, removes the device token |

## Alerts

| Method | Path | Notes |
|---|---|---|
| GET | `/alerts?limit&offset&category&risk` | paginated feed, newest first |
| GET | `/alerts/high-impact` | last 20 High/Critical alerts |
| GET | `/alerts/dashboard` | `{riskMeter (0-100 avg urgency 24h), topSectors, topTickers, categories}` |
| GET | `/alerts/:id` | full detail `{alert, similar[]}` — similar = older alerts sharing a category |
| GET | `/alerts/by-category/:category` | e.g. `Tariffs`, `Federal Reserve` |
| GET | `/alerts/by-ticker/:ticker` | e.g. `NVDA`, `BTC` |

Alert object:
```json
{
  "id": "uuid", "riskLevel": "Critical", "categories": ["Tariffs","China"],
  "summary": "...", "affectedSectors": ["Technology"], "sentiment": "Negative",
  "urgencyScore": 95, "reasoning": "...", "title": "...", "confirmed": true,
  "createdAt": "ISO", "originalStatement": "verbatim text", "sourceUrl": "https://...",
  "statedAt": "ISO", "detectedAt": "ISO", "sourceName": "White House — Briefing Room",
  "sourceReliability": 95, "tickers": ["AAPL","NVDA"]
}
```

## Watchlist

| Method | Path | Body |
|---|---|---|
| GET | `/watchlist` | → `{tickers: ["NVDA", ...]}` |
| POST | `/watchlist` | `{ticker}` (1–8 chars `[A-Z0-9.]`, uppercased) |
| DELETE | `/watchlist/:ticker` | |

## Notification preferences

`GET /notification-preferences` · `PUT /notification-preferences`
```json
{
  "minRiskLevel": "High",         // Low | Medium | High | Critical
  "categories": [],                // empty = all categories
  "tickersOnly": false,            // only watchlist-matching alerts
  "quietHoursStart": 22, "quietHoursEnd": 7,  // local hours, null = disabled
  "timezone": "America/New_York",
  "soundEnabled": true, "vibrationEnabled": true
}
```
Critical alerts and watchlist matches break through quiet hours.

## Sources & misc

- `GET /sources` — sources with reliability scores and statement counts.
- `GET /health` — `{status, checks: {db, redis}}`, 503 when degraded.
- `GET /legal/disclaimer` — disclaimer + privacy-policy placeholder text.

## Admin (role = admin)

- `GET /admin/raw-statements?status=&limit=` — ingested raw statements
- `GET /admin/alerts` — processed alerts with original text
- `PATCH /admin/alerts/:id` — `{riskLevel?, categories?, retract?}`; corrections lower source reliability by 2 and are logged in `admin_flags`
- `POST /admin/alerts/:id/resend` — re-enqueue notification dispatch
- `PATCH /admin/sources/:id` — `{enabled?, reliabilityScore?}`
- `GET /admin/logs/notifications`, `GET /admin/logs/ai`
