import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { requireAuth } from '../../lib/authPlugin.js';
import { notFound } from '../../lib/errors.js';
import { adapterByKey } from '../../ingestion/adapters/index.js';
import { env } from '../../config/env.js';

/**
 * Endpoints the web dashboard consumes. All same-origin (the SPA is served by
 * this backend), so there is no CORS and no browser-side RSS proxying.
 */
export async function webDataRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // ── Dashboard aggregate ───────────────────────────────────────────────────
  app.get('/dashboard', async () => {
    const [src] = await query<{ connected: string; failed: string; total: string }>(`
      SELECT
        count(*) FILTER (WHERE s.enabled AND h.last_success_at IS NOT NULL AND h.last_item_count > 0)::text AS connected,
        count(*) FILTER (WHERE s.enabled AND h.last_error <> '' AND h.last_success_at IS NULL)::text AS failed,
        count(*) FILTER (WHERE s.enabled)::text AS total
      FROM sources s LEFT JOIN source_health h ON h.source_id = s.id`);

    const [raw] = await query<{ today: string; total: string }>(`
      SELECT count(*) FILTER (WHERE detected_at > date_trunc('day', now()))::text AS today,
             count(*)::text AS total FROM raw_statements`);

    const [alerts] = await query<{ today: string; total: string; high: string }>(`
      SELECT count(*) FILTER (WHERE created_at > date_trunc('day', now()))::text AS today,
             count(*)::text AS total,
             count(*) FILTER (WHERE risk_level IN ('High','Critical') AND created_at > now() - interval '24 hours')::text AS high
      FROM processed_alerts WHERE is_market_relevant = TRUE`);

    const [meter] = await query<{ score: number | null }>(`
      SELECT ROUND(AVG(urgency_score)) AS score FROM processed_alerts
      WHERE created_at > now() - interval '24 hours' AND is_market_relevant = TRUE`);

    const topSectors = await query(`
      SELECT unnest(affected_sectors) AS sector, count(*)::int AS count
      FROM processed_alerts WHERE created_at > now() - interval '24 hours' AND is_market_relevant = TRUE
      GROUP BY 1 ORDER BY 2 DESC LIMIT 8`);

    const topTickers = await query(`
      SELECT at.ticker, count(*)::int AS count
      FROM alert_tickers at JOIN processed_alerts a ON a.id = at.alert_id
      WHERE a.created_at > now() - interval '24 hours'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10`);

    const latestAlerts = await query(`
      SELECT a.id, a.risk_level AS "riskLevel", a.categories, a.summary,
             a.notification_title AS "title", a.urgency_score AS "urgencyScore",
             a.confirmed, a.created_at AS "createdAt",
             s.name AS "sourceName", rs.source_url AS "sourceUrl", rs.stated_at AS "statedAt",
             COALESCE(array_agg(at.ticker) FILTER (WHERE at.ticker IS NOT NULL), '{}') AS tickers
      FROM processed_alerts a
      JOIN raw_statements rs ON rs.id = a.raw_statement_id
      JOIN sources s ON s.id = rs.source_id
      LEFT JOIN alert_tickers at ON at.alert_id = a.id
      WHERE a.is_market_relevant = TRUE
      GROUP BY a.id, s.name, rs.source_url, rs.stated_at
      ORDER BY rs.stated_at DESC NULLS LAST, a.created_at DESC LIMIT 6`);

    // Truth Social status (most important source).
    const ts = await queryOne<{
      status: number | null; success: string | null; error: string | null; items: number | null;
    }>(`SELECT h.last_http_status AS status, h.last_success_at AS success, h.last_error AS error, h.last_item_count AS items
        FROM sources s LEFT JOIN source_health h ON h.source_id = s.id WHERE s.key = 'truth_social'`);
    const tsSample = await queryOne<{ content: string; stated_at: Date; url: string }>(`
      SELECT left(rs.content, 200) AS content, rs.stated_at, rs.source_url AS url
      FROM raw_statements rs JOIN sources s ON s.id = rs.source_id
      WHERE s.key = 'truth_social' ORDER BY rs.stated_at DESC NULLS LAST LIMIT 1`);
    const tsConnected = !!ts?.success && Number(ts?.items ?? 0) > 0;

    return {
      sources: { connected: Number(src?.connected ?? 0), failed: Number(src?.failed ?? 0), total: Number(src?.total ?? 0) },
      rawStatements: { today: Number(raw?.today ?? 0), total: Number(raw?.total ?? 0) },
      processedAlerts: { today: Number(alerts?.today ?? 0), total: Number(alerts?.total ?? 0) },
      highCriticalAlerts: Number(alerts?.high ?? 0),
      riskMeter: meter?.score ?? 0,
      topSectors, topTickers, latestAlerts,
      truthSocial: {
        status: tsConnected ? 'connected' : 'blocked',
        reason: tsConnected
          ? `Live via system-curl workaround (${ts?.items} posts last poll)`
          : `Blocked — Cloudflare/TLS fingerprint (last HTTP ${ts?.status ?? '-'}). Requires curl workaround or paid provider.`,
        sample: tsSample ? { content: tsSample.content.replace(/\s+/g, ' '), statedAt: tsSample.stated_at, url: tsSample.url } : null,
      },
    };
  });

  // ── Raw statements list ───────────────────────────────────────────────────
  app.get('/raw-statements', async (req) => {
    const q = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(40),
      offset: z.coerce.number().int().min(0).default(0),
      status: z.enum(['pending', 'processed', 'skipped', 'duplicate']).optional(),
    }).parse(req.query);
    const params: unknown[] = [];
    let where = '';
    if (q.status) { params.push(q.status); where = `WHERE rs.status = $${params.length}`; }
    params.push(q.limit, q.offset);
    const rows = await query(`
      SELECT rs.id, rs.content, rs.external_id AS "externalId", rs.source_url AS "sourceUrl",
             rs.stated_at AS "statedAt", rs.detected_at AS "detectedAt", rs.status,
             rs.confirmation_count AS "confirmationCount",
             s.name AS "sourceName", s.source_group AS "sourceGroup",
             (po.id IS NOT NULL) AS "processed"
      FROM raw_statements rs
      JOIN sources s ON s.id = rs.source_id
      LEFT JOIN processed_alerts po ON po.raw_statement_id = rs.id
      ${where}
      ORDER BY rs.stated_at DESC NULLS LAST, rs.detected_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { items: rows };
  });

  app.get('/raw-statements/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const row = await queryOne(`
      SELECT rs.id, rs.content, rs.external_id AS "externalId", rs.source_url AS "sourceUrl",
             rs.content_hash AS "contentHash", rs.stated_at AS "statedAt", rs.detected_at AS "detectedAt",
             rs.status, rs.confidence_score AS "confidenceScore", rs.confirmation_count AS "confirmationCount",
             rs.metadata, s.name AS "sourceName", s.key AS "sourceKey", s.source_group AS "sourceGroup",
             (po.id IS NOT NULL) AS "processed"
      FROM raw_statements rs
      JOIN sources s ON s.id = rs.source_id
      LEFT JOIN processed_alerts po ON po.raw_statement_id = rs.id
      WHERE rs.id = $1`, [id]);
    if (!row) throw notFound('Raw statement not found');
    return { statement: row };
  });

  // ── Settings / environment status ─────────────────────────────────────────
  app.get('/settings/status', async () => {
    const sources = await query<{ key: string; name: string; enabled: boolean; pollSeconds: number; group: string }>(`
      SELECT key, name, enabled, poll_seconds AS "pollSeconds", source_group AS "group"
      FROM sources ORDER BY enabled DESC, source_group, key`);
    const withMeta = sources.map((s) => ({ ...s, requiresKey: adapterByKey.get(s.key)?.requiresKey ?? false, hasAdapter: adapterByKey.has(s.key) }));
    return {
      polling: {
        defaultSeconds: env.INGEST_POLL_SECONDS_DEFAULT,
        schedulerEnabled: process.env.RUN_SCHEDULER === 'true',
        schedulerIntervalSeconds: Number(process.env.SCHEDULER_INTERVAL_SECONDS) || 90,
      },
      apiKeys: {
        anthropic: process.env.ANTHROPIC_API_KEY ? 'set' : 'not set (rules classifier active)',
        newsApi: process.env.NEWS_API_KEY ? 'set' : 'not set',
        firebase: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_PATH ? 'set' : 'not set (notifications logged only)',
      },
      environment: {
        nodeEnv: env.NODE_ENV,
        node: process.version,
        dedupeWindowHours: env.DEDUPE_WINDOW_HOURS,
        dedupeSimilarity: env.DEDUPE_SIMILARITY_THRESHOLD,
      },
      sources: withMeta,
      disclaimer:
        'Trump Trading provides informational alerts about public political statements. It is NOT investment advice. ' +
        'Automated analysis may be wrong, incomplete, or delayed. Verify at the original source before acting.',
    };
  });
}
