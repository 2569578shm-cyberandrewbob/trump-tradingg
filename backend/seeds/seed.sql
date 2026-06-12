-- Seed sources (adapters must exist for each key)
INSERT INTO sources (key, name, type, url, enabled, poll_seconds) VALUES
  ('truth_social',    'Truth Social (official posts)',        'truth_social', 'https://truthsocial.com/@realDonaldTrump', FALSE, 30),
  ('whitehouse_news', 'White House — Briefing Room',          'gov_feed',     'https://www.whitehouse.gov/news/feed/',    TRUE,  120),
  ('reuters_politics','Reuters Politics RSS',                 'rss',          'https://www.reutersagency.com/feed/?best-topics=political-general', TRUE, 90),
  ('ap_politics',     'Associated Press Politics RSS',        'rss',          'https://rsshub.app/ap/topics/politics',    TRUE,  90),
  ('news_api',        'NewsAPI breaking headlines',           'news_api',     'https://newsapi.org',                      FALSE, 120),
  ('press_transcripts','Press conference transcripts (Roll Call FactBase style feed)', 'transcript', NULL, FALSE, 300)
ON CONFLICT (key) DO NOTHING;

INSERT INTO source_reliability (source_id, reliability_score, notes)
SELECT id,
  CASE key
    WHEN 'truth_social'     THEN 95  -- primary source, verbatim
    WHEN 'whitehouse_news'  THEN 95  -- official government feed
    WHEN 'reuters_politics' THEN 90
    WHEN 'ap_politics'      THEN 90
    WHEN 'news_api'         THEN 60  -- aggregator, mixed outlets
    WHEN 'press_transcripts' THEN 85
    ELSE 50
  END,
  'seeded default'
FROM sources
ON CONFLICT (source_id) DO NOTHING;

-- Demo admin user (password: Admin123! — change immediately) and demo user (password: Demo123!)
INSERT INTO users (email, password_hash, display_name, role) VALUES
  ('admin@trumptrading.app', '$2a$10$Q9PpieuxBzhpgquCgPDpQ.cHGdyVAxNTFTSwIWE/2eDqQI24M3rsa', 'Admin', 'admin'),
  ('demo@trumptrading.app',  '$2a$10$cnksOOJWLtnPBqcSeAUOH.Z.aybvZNAY5XdwQqU3F6q4VZJ/rdEoO', 'Demo Trader', 'user')
ON CONFLICT (email) DO NOTHING;

INSERT INTO notification_preferences (user_id, min_risk_level)
SELECT id, 'High' FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Demo watchlist
INSERT INTO watchlists (user_id, ticker)
SELECT u.id, t.ticker
FROM users u, (VALUES ('NVDA'),('TSLA'),('AAPL'),('BTC'),('GOLD'),('OIL')) AS t(ticker)
WHERE u.email = 'demo@trumptrading.app'
ON CONFLICT DO NOTHING;

-- Demo statement + alert so the app has content on first run
WITH src AS (SELECT id FROM sources WHERE key = 'whitehouse_news'),
ins AS (
  INSERT INTO raw_statements (source_id, content, content_hash, source_url, stated_at, confidence_score, status)
  SELECT id,
    'We may impose a 50% tariff on Chinese imports. Details to follow next week.',
    'demo-seed-hash-0001',
    'https://www.whitehouse.gov/news/demo',
    now() - interval '1 hour', 95, 'processed'
  FROM src
  ON CONFLICT (content_hash) DO NOTHING
  RETURNING id
)
INSERT INTO processed_alerts (raw_statement_id, is_market_relevant, risk_level, categories, summary,
  affected_sectors, sentiment, urgency_score, reasoning, notification_title, notification_body, confirmed, analysis_engine)
SELECT id, TRUE, 'Critical', ARRAY['Tariffs','China','Trade deals'],
  'Statement signals a possible 50% tariff on Chinese imports, with details expected next week.',
  ARRAY['Technology','Retail','Semiconductors','Industrials'], 'Negative', 95,
  'Direct tariff threat against the largest US trading partner historically moves equities, especially China-exposed tech and retail.',
  'CRITICAL: Trump tariff statement detected',
  'Possible impact on China-linked stocks, tech, semiconductors, and retail. Tap to view full statement.',
  TRUE, 'rules'
FROM ins
ON CONFLICT (raw_statement_id) DO NOTHING;

INSERT INTO alert_tickers (alert_id, ticker)
SELECT a.id, t.ticker
FROM processed_alerts a
JOIN raw_statements r ON r.id = a.raw_statement_id AND r.content_hash = 'demo-seed-hash-0001',
(VALUES ('AAPL'),('NVDA'),('TSLA'),('WMT'),('TSM'),('BABA')) AS t(ticker)
ON CONFLICT DO NOTHING;
