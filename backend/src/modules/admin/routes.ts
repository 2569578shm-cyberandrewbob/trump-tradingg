import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { requireAdmin } from '../../lib/authPlugin.js';
import { notFound } from '../../lib/errors.js';
import { CATEGORIES, RISK_LEVELS } from '../../lib/types.js';
import { notifyQueue } from '../../queue/queues.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdmin);

  app.get('/admin/raw-statements', async (req) => {
    const q = z.object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
      status: z.enum(['pending', 'processed', 'skipped', 'duplicate']).optional(),
    }).parse(req.query);
    const rows = await query(
      `SELECT rs.*, s.name AS source_name FROM raw_statements rs
       JOIN sources s ON s.id = rs.source_id
       ${q.status ? 'WHERE rs.status = $2' : ''}
       ORDER BY rs.detected_at DESC LIMIT $1`,
      q.status ? [q.limit, q.status] : [q.limit],
    );
    return { statements: rows };
  });

  app.get('/admin/alerts', async () => {
    const rows = await query(
      `SELECT a.*, rs.content, rs.source_url FROM processed_alerts a
       JOIN raw_statements rs ON rs.id = a.raw_statement_id
       ORDER BY a.created_at DESC LIMIT 100`,
    );
    return { alerts: rows };
  });

  /** Manually correct an alert's category/risk; logged to admin_flags and reliability stats. */
  app.patch('/admin/alerts/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      riskLevel: z.enum(RISK_LEVELS).optional(),
      categories: z.array(z.enum(CATEGORIES)).optional(),
      retract: z.boolean().optional(),
    }).parse(req.body);

    const alert = await queryOne<{ id: string; raw_statement_id: string }>(
      `SELECT id, raw_statement_id FROM processed_alerts WHERE id = $1`, [id]);
    if (!alert) throw notFound('Alert not found');

    if (body.riskLevel) {
      await query(`UPDATE processed_alerts SET risk_level = $2, analysis_engine = 'admin' WHERE id = $1`, [id, body.riskLevel]);
    }
    if (body.categories) {
      await query(`UPDATE processed_alerts SET categories = $2, analysis_engine = 'admin' WHERE id = $1`, [id, body.categories]);
    }
    if (body.retract) {
      await query(`UPDATE processed_alerts SET is_market_relevant = FALSE WHERE id = $1`, [id]);
    }
    await query(
      `INSERT INTO admin_flags (alert_id, admin_id, action, details) VALUES ($1,$2,$3,$4)`,
      [id, req.user.sub, body.retract ? 'retract' : body.riskLevel ? 'correct_risk' : 'correct_category', JSON.stringify(body)],
    );
    // corrections count against the source's reliability
    await query(
      `UPDATE source_reliability SET corrected_alerts = corrected_alerts + 1,
         reliability_score = GREATEST(0, reliability_score - 2), updated_at = now()
       WHERE source_id = (SELECT source_id FROM raw_statements WHERE id = $1)`,
      [alert.raw_statement_id],
    );
    return { ok: true };
  });

  app.post('/admin/alerts/:id/resend', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await notifyQueue.add('notify', { alertId: id });
    await query(`INSERT INTO admin_flags (alert_id, admin_id, action) VALUES ($1,$2,'resend')`, [id, req.user.sub]);
    return { ok: true };
  });

  app.patch('/admin/sources/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      enabled: z.boolean().optional(),
      reliabilityScore: z.number().int().min(0).max(100).optional(),
    }).parse(req.body);
    if (body.enabled !== undefined) {
      await query(`UPDATE sources SET enabled = $2 WHERE id = $1`, [id, body.enabled]);
      await query(`INSERT INTO admin_flags (source_id, admin_id, action) VALUES ($1,$2,$3)`,
        [id, req.user.sub, body.enabled ? 'enable_source' : 'disable_source']);
    }
    if (body.reliabilityScore !== undefined) {
      await query(
        `INSERT INTO source_reliability (source_id, reliability_score) VALUES ($1,$2)
         ON CONFLICT (source_id) DO UPDATE SET reliability_score = $2, updated_at = now()`,
        [id, body.reliabilityScore],
      );
    }
    return { ok: true };
  });

  app.get('/admin/logs/notifications', async () => {
    const rows = await query(
      `SELECT nl.*, u.email FROM notification_logs nl JOIN users u ON u.id = nl.user_id
       ORDER BY nl.sent_at DESC LIMIT 200`,
    );
    return { logs: rows };
  });

  app.get('/admin/logs/ai', async () => {
    const rows = await query(`SELECT * FROM ai_analysis_logs ORDER BY created_at DESC LIMIT 100`);
    return { logs: rows };
  });
}
