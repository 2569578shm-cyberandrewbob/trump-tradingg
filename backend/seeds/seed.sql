-- ============================================================================
-- Seed: real, verified data sources (each key has a registered adapter unless
-- noted). Reachability audited 2026-06-13. No demo statements are seeded —
-- content comes from real ingestion so verification is unambiguous.
-- ============================================================================

INSERT INTO sources (key, name, type, url, enabled, poll_seconds) VALUES
  ('truth_social',           'Truth Social — @realDonaldTrump (official)',   'truth_social', 'https://truthsocial.com/@realDonaldTrump', TRUE,  60),
  ('whitehouse_news',        'White House — News & Releases',                'gov_feed',     'https://www.whitehouse.gov/news/feed/',    TRUE,  120),
  ('whitehouse_actions',     'White House — Presidential Actions',           'gov_feed',     'https://www.whitehouse.gov/presidential-actions/feed/', TRUE, 300),
  ('googlenews_trump',       'Google News — Trump (aggregator)',             'rss',          'https://news.google.com/rss/search?q=Trump', TRUE, 120),
  ('ap_googlenews',          'AP News — Trump (via Google News)',            'rss',          'https://news.google.com/rss/search?q=Trump+site:apnews.com', TRUE, 180),
  ('cnbc_top',               'CNBC — Top News',                              'rss',          'https://www.cnbc.com/id/100003114/device/rss/rss.html', TRUE, 180),
  ('cnbc_economy',           'CNBC — Economy',                               'rss',          'https://www.cnbc.com/id/20910258/device/rss/rss.html',  TRUE, 180),
  ('marketwatch',            'MarketWatch — Top Stories',                    'rss',          'https://feeds.content.dowjones.io/public/rss/mw_topstories', TRUE, 180),
  ('yahoo_finance',          'Yahoo Finance — Headlines',                    'rss',          'https://feeds.finance.yahoo.com/rss/2.0/headline', TRUE, 180),
  ('transcripts_googlenews', 'Trump remarks/transcripts (delayed monitor)',  'transcript',   'https://news.google.com/rss/search?q=Trump+transcript', TRUE, 300),
  -- Disabled: requires an API key (surfaced as "requires key", never silently skipped)
  ('news_api',               'NewsAPI breaking headlines (requires key)',    'news_api',     'https://newsapi.org', FALSE, 120),
  -- Disabled: no working adapter — Reuters public RSS was discontinued; needs licensed Reuters Connect API
  ('reuters_rss',            'Reuters RSS (discontinued — needs license)',   'rss',          'https://www.reutersagency.com/feed/', FALSE, 180)
ON CONFLICT (key) DO NOTHING;

INSERT INTO source_reliability (source_id, reliability_score, notes)
SELECT id,
  CASE key
    WHEN 'truth_social'           THEN 95
    WHEN 'whitehouse_news'        THEN 95
    WHEN 'whitehouse_actions'     THEN 95
    WHEN 'ap_googlenews'          THEN 85
    WHEN 'cnbc_top'               THEN 80
    WHEN 'cnbc_economy'           THEN 80
    WHEN 'marketwatch'            THEN 78
    WHEN 'yahoo_finance'          THEN 75
    WHEN 'transcripts_googlenews' THEN 80
    WHEN 'googlenews_trump'       THEN 70
    WHEN 'news_api'               THEN 60
    WHEN 'reuters_rss'            THEN 90
    ELSE 50
  END,
  'seeded default'
FROM sources
ON CONFLICT (source_id) DO NOTHING;

-- Demo admin (password: Admin123!) and demo user (password: Demo123!). Change immediately.
INSERT INTO users (email, password_hash, display_name, role) VALUES
  ('admin@trumptrading.app', '$2a$10$O3r3QRSlacHtf1URFnUOjuzFE4GCe8aLboNFHPuRRWMpm/wzU36G.', 'Admin', 'admin'),
  ('demo@trumptrading.app',  '$2a$10$ySkDvypeUTCBzHq70avwSOguJoGTJiWlBW6zkfDVg51F6.32iRUzK', 'Demo Trader', 'user')
ON CONFLICT (email) DO NOTHING;

-- Demo user gets a PLACEHOLDER FCM token so the notification dispatcher's
-- logging path is exercisable. This is NOT a real device; actual push delivery
-- requires a configured Firebase service account.
UPDATE users SET fcm_tokens = ARRAY['PLACEHOLDER_FCM_TOKEN_NOT_A_REAL_DEVICE']
WHERE email = 'demo@trumptrading.app' AND cardinality(fcm_tokens) = 0;

INSERT INTO notification_preferences (user_id, min_risk_level)
SELECT id, CASE WHEN email = 'demo@trumptrading.app' THEN 'Low' ELSE 'High' END
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Demo watchlist
INSERT INTO watchlists (user_id, ticker)
SELECT u.id, t.ticker
FROM users u, (VALUES ('NVDA'),('TSLA'),('AAPL'),('BTC'),('GOLD'),('OIL'),('LMT'),('XOM')) AS t(ticker)
WHERE u.email = 'demo@trumptrading.app'
ON CONFLICT DO NOTHING;
