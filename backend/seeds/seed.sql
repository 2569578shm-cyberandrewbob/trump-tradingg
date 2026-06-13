-- ============================================================================
-- Seed: real, verified data sources (each key has a registered adapter unless
-- noted). Reachability audited 2026-06-13. No demo statements are seeded —
-- content comes from real ingestion so verification is unambiguous.
-- ============================================================================

INSERT INTO sources (key, name, type, url, enabled, poll_seconds, source_group, source_kind) VALUES
  -- ── Truth Social (direct) ──
  ('truth_social',           'Truth Social — @realDonaldTrump (direct)',     'truth_social', 'https://truthsocial.com/@realDonaldTrump', TRUE,  60,  'truth_social_direct', 'direct_official'),
  -- ── Truth Social via News (news reports about Truth Social activity — NOT direct posts) ──
  ('tsn_core',               'Truth Social via News — general',              'rss', 'https://news.google.com/rss/search?q=%22Trump%22+%22Truth+Social%22', TRUE, 180, 'truth_social_news', 'news_fallback'),
  ('tsn_markets',            'Truth Social via News — markets',              'rss', 'https://news.google.com/rss/search?q=Trump+Truth+Social+markets', TRUE, 180, 'truth_social_news', 'news_fallback'),
  ('tsn_geo',                'Truth Social via News — geopolitics',          'rss', 'https://news.google.com/rss/search?q=Trump+Truth+Social+war', TRUE, 180, 'truth_social_news', 'news_fallback'),
  -- ── Official US government ──
  ('whitehouse_news',        'White House — News & Releases',                'gov_feed', 'https://www.whitehouse.gov/news/feed/', TRUE, 120, 'official', 'direct_official'),
  ('whitehouse_briefing',    'White House — Briefing Room',                  'gov_feed', 'https://www.whitehouse.gov/briefing-room/feed/', TRUE, 180, 'official', 'direct_official'),
  ('whitehouse_actions',     'White House — Presidential Actions',           'gov_feed', 'https://www.whitehouse.gov/presidential-actions/feed/', TRUE, 300, 'official', 'direct_official'),
  ('whitehouse_remarks',     'White House — Speeches & Remarks',             'gov_feed', 'https://www.whitehouse.gov/remarks/feed/', TRUE, 300, 'official', 'direct_official'),
  ('federal_register',       'Federal Register — Presidential Documents',    'gov_feed', 'https://www.federalregister.gov/api/v1/documents.rss?conditions%5Btype%5D%5B%5D=PRESDOCU&order=newest', TRUE, 600, 'official', 'direct_official'),
  ('treasury_press',         'U.S. Treasury — press (via news)',             'rss', 'https://news.google.com/rss/search?q=Treasury+site:home.treasury.gov', TRUE, 600, 'official', 'news_fallback'),
  ('state_press',            'U.S. State Dept — press (via news)',           'rss', 'https://news.google.com/rss/search?q=site:state.gov', TRUE, 600, 'official', 'news_fallback'),
  ('defense_press',          'U.S. Defense Dept — releases (via news)',      'rss', 'https://news.google.com/rss/search?q=site:defense.gov', TRUE, 600, 'official', 'news_fallback'),
  ('ustr_press',             'USTR — tariffs/trade (via news)',              'rss', 'https://news.google.com/rss/search?q=site:ustr.gov', TRUE, 600, 'official', 'news_fallback'),
  ('fed_press',              'Federal Reserve — press (via news)',           'rss', 'https://news.google.com/rss/search?q=site:federalreserve.gov', TRUE, 600, 'official', 'news_fallback'),
  -- ── Market & financial news ──
  ('cnbc_top',               'CNBC — Top News',                              'rss', 'https://www.cnbc.com/id/100003114/device/rss/rss.html', TRUE, 180, 'market', 'news_fallback'),
  ('cnbc_economy',           'CNBC — Economy',                               'rss', 'https://www.cnbc.com/id/20910258/device/rss/rss.html', TRUE, 180, 'market', 'news_fallback'),
  ('cnbc_markets',           'CNBC — Markets',                               'rss', 'https://www.cnbc.com/id/15839135/device/rss/rss.html', TRUE, 180, 'market', 'news_fallback'),
  ('marketwatch',            'MarketWatch — Top Stories',                    'rss', 'https://feeds.content.dowjones.io/public/rss/mw_topstories', TRUE, 180, 'market', 'news_fallback'),
  ('yahoo_finance',          'Yahoo Finance — Headlines',                    'rss', 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US', TRUE, 180, 'market', 'news_fallback'),
  ('reuters_trump',          'Reuters — Trump (via news)',                   'rss', 'https://news.google.com/rss/search?q=Trump+site:reuters.com', TRUE, 240, 'market', 'news_fallback'),
  ('cnbc_trump',             'CNBC — Trump (via news)',                      'rss', 'https://news.google.com/rss/search?q=Trump+site:cnbc.com', TRUE, 240, 'market', 'news_fallback'),
  ('marketwatch_trump',      'MarketWatch — Trump (via news)',               'rss', 'https://news.google.com/rss/search?q=Trump+site:marketwatch.com', TRUE, 240, 'market', 'news_fallback'),
  ('yahoo_trump',            'Yahoo Finance — Trump (via news)',             'rss', 'https://news.google.com/rss/search?q=Trump+site:finance.yahoo.com', TRUE, 240, 'market', 'news_fallback'),
  ('investing_trump',        'Investing.com — Trump (via news)',             'rss', 'https://news.google.com/rss/search?q=Trump+site:investing.com', TRUE, 300, 'market', 'news_fallback'),
  -- ── General reliable news ──
  ('ap_googlenews',          'AP News — Trump',                              'rss', 'https://news.google.com/rss/search?q=Trump+site:apnews.com', TRUE, 180, 'general', 'news_fallback'),
  ('bbc_trump',              'BBC — Trump',                                  'rss', 'https://news.google.com/rss/search?q=Trump+site:bbc.com', TRUE, 240, 'general', 'news_fallback'),
  ('cnn_trump',              'CNN — Trump',                                  'rss', 'https://news.google.com/rss/search?q=Trump+site:cnn.com', TRUE, 240, 'general', 'news_fallback'),
  ('foxnews_trump',          'Fox News — Trump',                             'rss', 'https://news.google.com/rss/search?q=Trump+site:foxnews.com', TRUE, 240, 'general', 'news_fallback'),
  ('guardian_trump',         'The Guardian — Trump',                         'rss', 'https://news.google.com/rss/search?q=Trump+site:theguardian.com', TRUE, 240, 'general', 'news_fallback'),
  ('politico_trump',         'Politico — Trump',                             'rss', 'https://news.google.com/rss/search?q=Trump+site:politico.com', TRUE, 240, 'general', 'news_fallback'),
  ('axios_trump',            'Axios — Trump',                                'rss', 'https://news.google.com/rss/search?q=Trump+site:axios.com', TRUE, 240, 'general', 'news_fallback'),
  ('thehill_trump',          'The Hill — Trump',                             'rss', 'https://news.google.com/rss/search?q=Trump+site:thehill.com', TRUE, 240, 'general', 'news_fallback'),
  ('npr_trump',              'NPR — Trump',                                  'rss', 'https://news.google.com/rss/search?q=Trump+site:npr.org', TRUE, 300, 'general', 'news_fallback'),
  ('cbs_trump',              'CBS News — Trump',                             'rss', 'https://news.google.com/rss/search?q=Trump+site:cbsnews.com', TRUE, 300, 'general', 'news_fallback'),
  ('abc_trump',              'ABC News — Trump',                             'rss', 'https://news.google.com/rss/search?q=Trump+site:abcnews.go.com', TRUE, 300, 'general', 'news_fallback'),
  ('nbc_trump',              'NBC News — Trump',                             'rss', 'https://news.google.com/rss/search?q=Trump+site:nbcnews.com', TRUE, 300, 'general', 'news_fallback'),
  ('nyt_trump',              'New York Times — Trump',                       'rss', 'https://news.google.com/rss/search?q=Trump+site:nytimes.com', TRUE, 300, 'general', 'news_fallback'),
  ('wapo_trump',             'Washington Post — Trump',                      'rss', 'https://news.google.com/rss/search?q=Trump+site:washingtonpost.com', TRUE, 300, 'general', 'news_fallback'),
  -- ── International / geopolitical ──
  ('aljazeera_trump',        'Al Jazeera — Trump',                           'rss', 'https://news.google.com/rss/search?q=Trump+site:aljazeera.com', TRUE, 300, 'geopolitical', 'news_fallback'),
  ('france24_trump',         'France24 — Trump',                             'rss', 'https://news.google.com/rss/search?q=Trump+site:france24.com', TRUE, 300, 'geopolitical', 'news_fallback'),
  ('dw_trump',               'DW — Trump',                                   'rss', 'https://news.google.com/rss/search?q=Trump+site:dw.com', TRUE, 300, 'geopolitical', 'news_fallback'),
  ('reuters_world',          'Reuters — World conflict',                     'rss', 'https://news.google.com/rss/search?q=war+site:reuters.com', TRUE, 240, 'geopolitical', 'news_fallback'),
  ('ap_world',               'AP — World conflict',                          'rss', 'https://news.google.com/rss/search?q=war+site:apnews.com', TRUE, 240, 'geopolitical', 'news_fallback'),
  ('bbc_world',              'BBC — World conflict',                         'rss', 'https://news.google.com/rss/search?q=war+site:bbc.com', TRUE, 240, 'geopolitical', 'news_fallback'),
  ('un_news',                'United Nations — news',                        'rss', 'https://news.google.com/rss/search?q=United+Nations', TRUE, 600, 'geopolitical', 'news_fallback'),
  ('nato_news',              'NATO — news',                                  'rss', 'https://news.google.com/rss/search?q=NATO', TRUE, 600, 'geopolitical', 'news_fallback'),
  ('kremlin_news',           'Kremlin / Putin — statements (via news)',      'rss', 'https://news.google.com/rss/search?q=Kremlin+Putin', TRUE, 600, 'geopolitical', 'news_fallback'),
  ('ukraine_news',           'Ukraine — official (via news)',                'rss', 'https://news.google.com/rss/search?q=Zelensky+Ukraine', TRUE, 600, 'geopolitical', 'news_fallback'),
  ('israel_news',            'Israel — government (via news)',               'rss', 'https://news.google.com/rss/search?q=Israel+Netanyahu', TRUE, 600, 'geopolitical', 'news_fallback'),
  ('iran_news',              'Iran — foreign ministry (via news)',           'rss', 'https://news.google.com/rss/search?q=Iran+foreign+ministry', TRUE, 600, 'geopolitical', 'news_fallback'),
  -- ── Delayed transcripts ──
  ('transcripts_googlenews', 'Trump remarks/transcripts (delayed monitor)',  'transcript', 'https://news.google.com/rss/search?q=Trump+transcript', TRUE, 300, 'general', 'news_fallback'),
  -- ── Requires an API key (surfaced as "requires key", seeded disabled) ──
  ('news_api',               'NewsAPI breaking headlines (requires key)',    'news_api', 'https://newsapi.org', FALSE, 120, 'market', 'news_fallback')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, url = EXCLUDED.url, source_group = EXCLUDED.source_group,
  source_kind = EXCLUDED.source_kind, poll_seconds = EXCLUDED.poll_seconds;

INSERT INTO source_reliability (source_id, reliability_score, notes)
SELECT id,
  CASE
    WHEN key IN ('truth_social') THEN 95
    WHEN source_group = 'official' AND source_kind = 'direct_official' THEN 95
    WHEN key IN ('reuters_trump','reuters_world','ap_googlenews','ap_world','bbc_trump','bbc_world') THEN 88
    WHEN source_group = 'official' THEN 85
    WHEN key IN ('cnbc_top','cnbc_economy','cnbc_markets','cnbc_trump') THEN 82
    WHEN key IN ('npr_trump','cbs_trump','abc_trump','nbc_trump','politico_trump','axios_trump','thehill_trump') THEN 80
    WHEN key IN ('marketwatch','marketwatch_trump','yahoo_finance','yahoo_trump') THEN 78
    WHEN key IN ('nyt_trump','wapo_trump','guardian_trump') THEN 80
    WHEN source_group = 'truth_social_news' THEN 72
    WHEN source_group = 'geopolitical' THEN 75
    WHEN key = 'news_api' THEN 60
    ELSE 70
  END,
  'seeded default'
FROM sources
ON CONFLICT (source_id) DO UPDATE SET reliability_score = EXCLUDED.reliability_score;

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
