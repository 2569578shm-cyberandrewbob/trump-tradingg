import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { requireAuth } from '../../lib/authPlugin.js';
import { notFound } from '../../lib/errors.js';
import { CATEGORIES } from '../../lib/types.js';
import { analyzeMarketImpact } from '../../market/marketImpact.js';

/** Attach deterministic market-impact analysis to an alert/feed row. */
function withImpact<T extends Record<string, unknown>>(row: T): T {
  const text = [row.title, row.summary, row.originalStatement].filter(Boolean).join(' . ');
  const impact = analyzeMarketImpact({
    text,
    categories: (row.categories as string[]) ?? [],
    urgency: Number(row.urgencyScore ?? 0),
    confirmationCount: Number(row.confirmationCount ?? 0),
    sourceReliability: Number(row.sourceReliability ?? 50),
  });
  return { ...row, ...impact };
}

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
    const items = rows.map(withImpact);
    return { items, alerts: items };
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
    return { alerts: rows.map(withImpact) };
  });

  /** Latest market-impact analysis across recent feed items. */
  app.get('/market-impact', async (req) => {
    const q = listQuery.parse(req.query);
    const rows = await query(
      `${ALERT_SELECT} ${ALERT_GROUP}
       ORDER BY rs.stated_at DESC NULLS LAST, a.created_at DESC LIMIT $1 OFFSET $2`,
      [q.limit, q.offset],
    );
    const items = rows.map((r) => {
      const enriched = withImpact(r);
      return {
        id: enriched.id, title: enriched.title, summary: enriched.summary,
        category: (enriched.categories as string[])?.[0] ?? 'General',
        riskLevel: enriched.riskLevel, urgencyScore: enriched.urgencyScore,
        confirmationCount: enriched.confirmationCount, sourceName: enriched.sourceName,
        statedAt: enriched.statedAt,
        affected_assets: enriched.affected_assets, affected_etfs: enriched.affected_etfs,
        affected_commodities: enriched.affected_commodities, affected_macro_assets: enriched.affected_macro_assets,
        market_impact_summary: enriched.market_impact_summary,
      };
    });
    return { items };
  });

  /** Aggregated affected assets across the last 24 hours. */
  app.get('/assets/affected', async () => {
    const rows = await query(
      `${ALERT_SELECT} AND rs.stated_at > now() - interval '24 hours' ${ALERT_GROUP}
       ORDER BY rs.stated_at DESC NULLS LAST, a.created_at DESC LIMIT 400`,
    );
    type Tally = { symbol: string; name: string; sector?: string; category?: string; count: number; confSum: number; dirs: Record<string, number> };
    const stocks = new Map<string, Tally>();
    const etfs = new Map<string, Tally>();
    const commodities = new Map<string, Tally>();
    const sectors = new Map<string, number>();
    const catCount = new Map<string, number>();
    let urgencySum = 0;
    let latestHeadline = '';
    let latestAt: Date | null = null;

    const bump = (m: Map<string, Tally>, sym: string, name: string, conf: number, dir: string, extra: Partial<Tally>) => {
      const t = m.get(sym) ?? { symbol: sym, name, count: 0, confSum: 0, dirs: {}, ...extra };
      t.count++; t.confSum += conf; t.dirs[dir] = (t.dirs[dir] ?? 0) + 1;
      m.set(sym, t);
    };

    for (const r of rows) {
      const e = withImpact(r);
      urgencySum += Number(e.urgencyScore ?? 0);
      const at = e.statedAt ? new Date(e.statedAt as string) : null;
      if (at && (!latestAt || at > latestAt)) { latestAt = at; latestHeadline = String(e.title ?? e.summary ?? ''); }
      (e.categories as string[] ?? []).forEach((c) => catCount.set(c, (catCount.get(c) ?? 0) + 1));
      (e.affected_assets as { symbol: string; name: string; sector: string; confidence: number; possible_impact: string }[]).forEach((a) => {
        bump(stocks, a.symbol, a.name, a.confidence, a.possible_impact, { sector: a.sector });
        sectors.set(a.sector, (sectors.get(a.sector) ?? 0) + 1);
      });
      (e.affected_etfs as { symbol: string; name: string; category: string; confidence: number; possible_impact: string }[]).forEach((a) =>
        bump(etfs, a.symbol, a.name, a.confidence, a.possible_impact, { category: a.category }));
      (e.affected_commodities as { symbol: string; name: string; confidence: number; possible_impact: string }[]).forEach((a) =>
        bump(commodities, a.symbol, a.name, a.confidence, a.possible_impact, {}));
    }

    const finalize = (m: Map<string, Tally>, n: number) =>
      [...m.values()]
        .sort((a, b) => b.count - a.count || b.confSum - a.confSum)
        .slice(0, n)
        .map((t) => ({
          symbol: t.symbol, name: t.name, sector: t.sector, category: t.category,
          relatedItems: t.count, avgConfidence: Math.round(t.confSum / t.count),
          dominantImpact: Object.entries(t.dirs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'uncertain',
        }));

    const strongestCategory = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      windowHours: 24,
      relatedNewsItems: rows.length,
      averageUrgency: rows.length ? Math.round(urgencySum / rows.length) : 0,
      strongestCategory,
      latestHeadline,
      topStocks: finalize(stocks, 12),
      topEtfs: finalize(etfs, 10),
      topCommodities: finalize(commodities, 6),
      topSectors: [...sectors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([sector, count]) => ({ sector, count })),
      disclaimer: 'Informational only. Not financial advice. Market reactions are uncertain. Verify from original sources before trading.',
    };
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
    const enriched = withImpact(alert as Record<string, unknown>);
    // Historical similar examples: same primary category, older alerts.
    const similar = await query(
      `SELECT a2.id, a2.summary, a2.risk_level AS "riskLevel", a2.created_at AS "createdAt"
       FROM processed_alerts a2
       WHERE a2.id <> $1 AND a2.categories && (SELECT categories FROM processed_alerts WHERE id = $1)
       ORDER BY a2.created_at DESC LIMIT 5`,
      [id],
    );
    return { alert: enriched, similar };
  });
}
