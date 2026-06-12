CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ============ users ============
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  fcm_tokens    TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ sources ============
CREATE TABLE sources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key               TEXT NOT NULL UNIQUE,           -- adapter key, e.g. 'truth_social'
  name              TEXT NOT NULL,                  -- human-readable label
  type              TEXT NOT NULL CHECK (type IN ('truth_social','rss','news_api','transcript','gov_feed')),
  url               TEXT,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  poll_seconds      INT NOT NULL DEFAULT 60,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ source_reliability ============
CREATE TABLE source_reliability (
  source_id         UUID PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  reliability_score INT NOT NULL DEFAULT 50 CHECK (reliability_score BETWEEN 0 AND 100),
  total_statements  INT NOT NULL DEFAULT 0,
  corrected_alerts  INT NOT NULL DEFAULT 0,
  notes             TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ raw_statements ============
CREATE TABLE raw_statements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id          UUID NOT NULL REFERENCES sources(id),
  external_id        TEXT,                          -- id at the source, if any
  content            TEXT NOT NULL,                 -- verbatim original text, never modified
  content_hash       TEXT NOT NULL UNIQUE,          -- sha256 of normalized text (exact dedupe)
  source_url         TEXT NOT NULL,
  stated_at          TIMESTAMPTZ NOT NULL,          -- when the statement was made/published
  detected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence_score   INT NOT NULL DEFAULT 50 CHECK (confidence_score BETWEEN 0 AND 100),
  confirmation_count INT NOT NULL DEFAULT 1,        -- independent sources reporting same statement
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','skipped','duplicate')),
  metadata           JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX raw_statements_status_idx ON raw_statements (status) WHERE status = 'pending';
CREATE INDEX raw_statements_detected_idx ON raw_statements (detected_at DESC);
CREATE INDEX raw_statements_content_trgm_idx ON raw_statements USING gin (content gin_trgm_ops);

-- ============ processed_alerts ============
CREATE TABLE processed_alerts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_statement_id   UUID NOT NULL UNIQUE REFERENCES raw_statements(id),
  is_market_relevant BOOLEAN NOT NULL,
  risk_level         TEXT NOT NULL CHECK (risk_level IN ('Low','Medium','High','Critical')),
  categories         TEXT[] NOT NULL DEFAULT '{}',
  summary            TEXT NOT NULL,
  affected_sectors   TEXT[] NOT NULL DEFAULT '{}',
  sentiment          TEXT NOT NULL CHECK (sentiment IN ('Positive','Negative','Neutral','Mixed')),
  urgency_score      INT NOT NULL CHECK (urgency_score BETWEEN 0 AND 100),
  reasoning          TEXT NOT NULL DEFAULT '',
  notification_title TEXT NOT NULL,
  notification_body  TEXT NOT NULL,
  confirmed          BOOLEAN NOT NULL DEFAULT FALSE, -- passed reliability/confirmation safeguards
  analysis_engine    TEXT NOT NULL DEFAULT 'ai' CHECK (analysis_engine IN ('ai','rules','admin')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX processed_alerts_created_idx ON processed_alerts (created_at DESC);
CREATE INDEX processed_alerts_risk_idx ON processed_alerts (risk_level);
CREATE INDEX processed_alerts_categories_idx ON processed_alerts USING gin (categories);

-- ============ alert_tickers ============
CREATE TABLE alert_tickers (
  alert_id  UUID NOT NULL REFERENCES processed_alerts(id) ON DELETE CASCADE,
  ticker    TEXT NOT NULL,
  PRIMARY KEY (alert_id, ticker)
);
CREATE INDEX alert_tickers_ticker_idx ON alert_tickers (ticker);

-- ============ watchlists ============
CREATE TABLE watchlists (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticker     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ticker)
);

-- ============ notification_preferences ============
CREATE TABLE notification_preferences (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  min_risk_level    TEXT NOT NULL DEFAULT 'High' CHECK (min_risk_level IN ('Low','Medium','High','Critical')),
  categories        TEXT[] NOT NULL DEFAULT '{}',   -- empty = all categories
  tickers_only      BOOLEAN NOT NULL DEFAULT FALSE, -- only alerts matching watchlist
  quiet_hours_start SMALLINT CHECK (quiet_hours_start BETWEEN 0 AND 23),
  quiet_hours_end   SMALLINT CHECK (quiet_hours_end BETWEEN 0 AND 23),
  timezone          TEXT NOT NULL DEFAULT 'UTC',
  sound_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  vibration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ notification_logs ============
CREATE TABLE notification_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id    UUID NOT NULL REFERENCES processed_alerts(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  personalized BOOLEAN NOT NULL DEFAULT FALSE,      -- matched user's watchlist
  status      TEXT NOT NULL CHECK (status IN ('sent','failed','suppressed_quiet_hours','suppressed_prefs')),
  error       TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notification_logs_alert_idx ON notification_logs (alert_id);

-- ============ ai_analysis_logs ============
CREATE TABLE ai_analysis_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_statement_id UUID NOT NULL REFERENCES raw_statements(id),
  model            TEXT NOT NULL,
  prompt_tokens    INT,
  output_tokens    INT,
  raw_response     TEXT,
  valid_json       BOOLEAN NOT NULL,
  fallback_used    BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms       INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ admin_flags ============
CREATE TABLE admin_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id   UUID REFERENCES processed_alerts(id),
  source_id  UUID REFERENCES sources(id),
  admin_id   UUID NOT NULL REFERENCES users(id),
  action     TEXT NOT NULL CHECK (action IN ('correct_category','correct_risk','retract','resend','disable_source','enable_source','note')),
  details    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ refresh_tokens ============
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
