-- ============================================================================
-- 003 — Source grouping & kind classification
-- Adds the metadata the app needs to group sources in the UI and to tell
-- direct official sources apart from news fallbacks.
-- ============================================================================

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS source_group TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS source_kind  TEXT NOT NULL DEFAULT 'news_fallback';

-- source_group ∈ official | market | general | geopolitical | truth_social_direct | truth_social_news
-- source_kind  ∈ direct_official | news_fallback

COMMENT ON COLUMN sources.source_group IS 'UI grouping: official|market|general|geopolitical|truth_social_direct|truth_social_news';
COMMENT ON COLUMN sources.source_kind  IS 'direct_official (real official/RSS feed) or news_fallback (aggregated news search)';

CREATE INDEX IF NOT EXISTS idx_sources_group ON sources(source_group);
