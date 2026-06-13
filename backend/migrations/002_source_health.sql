-- Per-source health/telemetry for the source status dashboard, and a second
-- dedupe key (source + external post id) alongside the existing content hash.

CREATE TABLE source_health (
  source_id           UUID PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  last_poll_at        TIMESTAMPTZ,
  last_success_at     TIMESTAMPTZ,
  last_error          TEXT,
  last_http_status    INT,
  last_item_count     INT NOT NULL DEFAULT 0,   -- items fetched on the last poll
  last_new_count      INT NOT NULL DEFAULT 0,   -- new statements inserted on the last poll
  total_items_fetched BIGINT NOT NULL DEFAULT 0,
  total_new_inserted  BIGINT NOT NULL DEFAULT 0,
  poll_count          BIGINT NOT NULL DEFAULT 0,
  error_count         BIGINT NOT NULL DEFAULT 0,
  avg_latency_ms      DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Duplicate detection by post ID (in addition to content_hash text dedupe).
CREATE UNIQUE INDEX raw_statements_source_external_uniq
  ON raw_statements (source_id, external_id)
  WHERE external_id IS NOT NULL;
