import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { requireAuth } from '../../lib/authPlugin.js';
import { notFound } from '../../lib/errors.js';
import { CATEGORIES } from '../../lib/types.js';

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().optional(),
  risk: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
});

const ALERT_SELECT = `
  SELECT a.id, a.risk_level AS "riskLevel", a.categories, a.summary,
         a.affected_sectors AS "affectedSectors", a.sentiment, a.urgency_score AS "urgencyScore",
         a.reasoning, a.notification_title AS "title", a.confirmed, a.created_at AS "createdAt",
         rs.content AS "originalStatement", rs.source_url AS "sourceUrl",
         rs.stated_at AS "statedAt", rs.detected_at AS "detectedAt",
         COALESCE(rs.confirmation_count, 0) AS "confirmationCount",
         s.name AS "sourceName", s.source_group AS "sourceGroup", s.source_kind AS "sourceKind",
         COALESCE(sr.reliability_score, 50) AS "sourceReliability",
         COALESCE(array_agg(at.ticker) FILTER (WHERE at.ticker IS NOT NULL), '{}') AS tickers
  FROM processed_alerts a
  JOIN raw_statements rs ON rs.id = a.raw_statement_id
  JOIN sources s ON s.id = rs.source_id
  LEFT JOIN source_reliability sr ON sr.source_id = s.id
  LEFT JOIN alert_tickers at ON at.alert_id = a.id
  WHERE a.is_market_relevant = TRUE`;

const ALERT_GROUP = ` GROUP BY a.id, rs.id, s.name, s.source_group, s.source_kind, sr.reliability_score`;

export async function alertRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /**
   * Full feed: every market-relevant item, newest first, from all sources.
   * Includes category, urgency, confirmation count and source group/kind.
   */
  app.get('/feed', async (req) => {
    const q = listQuery.parse(req.query);
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (q.category) { params.push(q.category); conditions.push(`$${params.length} = ANY(a.categories)`); }
    if (q.risk) { params.push(q.risk); conditions.push(`a.risk_level = $${params.length}`); }
    params.push(q.limit, q.offset);
    const rows = await query(
      `${ALERT_SELECT} ${conditions.map((c) => ` AND ${c}`).join('')} ${ALERT_GROUP}
       ORDER BY rs.stated_at DESC NULLS LAST, a.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows, alerts: rows };
  });

  app.get('/alerts', async (req) => {
    const q = listQuery.parse(req.query);
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (q.category) {
      params.push(q.category);
      conditions.push(`$${params.length} = ANY(a.categories)`);
    }
    if (q.risk) {
      params.push(q.risk);
      conditions.push(`a.risk_level = $${params.length}`);
    }
    params.push(q.limit, q.offset);
    const where = conditions.map((c) => ` AND ${c}`).join('');
    const order = `ORDER BY rs.stated_at DESC NULLS LAST, a.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    // Live Alerts = urgent only (Medium/High/Critical). Fall back to the full
    // market-relevant feed when no urgent items exist yet, so the screen is
    // never blank in a fresh/sparse database.
    let rows = await query(
      `${ALERT_SELECT}${where} AND a.risk_level IN ('Medium','High','Critical') ${ALERT_GROUP} ${order}`,
      params,
    );
    if (!rows.length && !q.risk) {
      rows = await query(`${ALERT_SELECT}${where} ${ALERT_GROUP} ${order}`, params);
    }
    return { alerts: rows };
  });

  app.get('/alerts/high-impact', async () => {
    const rows = await query(
      `${ALERT_SELECT} AND a.risk_level IN ('High','Critical') ${ALERT_GROUP}
       ORDER BY a.created_at DESC LIMIT 20`,
    );
    return { alerts: rows };
  });

  app.get('/alerts/by-category/:category', async (req) => {
    const { category } = z.object({ category: z.string() }).parse(req.params);
    const rows = await query(
      `${ALERT_SELECT} AND $1 = ANY(a.categories) ${ALERT_GROUP} ORDER BY a.created_at DESC LIMIT 50`,
      [category],
    );
    return { alerts: rows };
  });

  app.get('/alerts/by-ticker/:ticker', async (req) => {
    const { ticker } = z.object({ ticker: z.string().regex(/^[A-Za-z0-9.]{1,8}$/) }).parse(req.params);
    const rows = await query(
      `${ALERT_SELECT} AND a.id IN (SELECT alert_id FROM alert_tickers WHERE ticker = $1)
       ${ALERT_GROUP} ORDER BY a.created_at DESC LIMIT 50`,
      [ticker.toUpperCase()],
    );
    return { alerts: rows };
  });

  /** Dashboard aggregates: risk meter, top sectors, top tickers (last 24h). */
  app.get('/alerts/dashboard', async () => {
    const [meter] = await query<{ score: number | null }>(
      `SELECT ROUND(AVG(urgency_score)) AS score FROM processed_alerts
       WHERE created_at > now() - interval '24 hours' AND is_market_relevant = TRUE`,
    );
    const sectors = await query(
      `SELECT unnest(affected_sectors) AS sector, count(*)::int AS count
       FROM processed_alerts WHERE created_at > now() - interval '24 hours' AND is_market_relevant = TRUE
       GROUP BY 1 ORDER BY 2 DESC LIMIT 6`,
    );
    const tickers = await query(
      `SELECT at.ticker, count(*)::int AS count
       FROM alert_tickers at JOIN processed_alerts a ON a.id = at.alert_id
       WHERE a.created_at > now() - interval '24 hours'
       GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
    );
    return {
      riskMeter: meter?.score ?? 0,
      topSectors: sectors,
      topTickers: tickers,
      categories: CATEGORIES,
    };
  });

  app.get('/alerts/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const alert = await queryOne(
      `${ALERT_SELECT} AND a.id = $1 ${ALERT_GROUP}`,
      [id],
    );
    if (!alert) throw notFound('Alert not found');
    // Historical similar examples: same primary category, older alerts.
    const similar = await query(
      `SELECT a2.id, a2.summary, a2.risk_level AS "riskLevel", a2.created_at AS "createdAt"
       FROM processed_alerts a2
       WHERE a2.id <> $1 AND a2.categories && (SELECT categories FROM processed_alerts WHERE id = $1)
       ORDER BY a2.created_at DESC LIMIT 5`,
      [id],
    );
    return { alert, similar };
  });
}
