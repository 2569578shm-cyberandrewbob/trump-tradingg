import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { requireAuth } from '../../lib/authPlugin.js';
import { CATEGORIES, RISK_LEVELS } from '../../lib/types.js';

const prefsSchema = z.object({
  minRiskLevel: z.enum(RISK_LEVELS).default('High'),
  categories: z.array(z.enum(CATEGORIES)).default([]),
  tickersOnly: z.boolean().default(false),
  quietHoursStart: z.number().int().min(0).max(23).nullable().default(null),
  quietHoursEnd: z.number().int().min(0).max(23).nullable().default(null),
  timezone: z.string().max(64).default('UTC'),
  soundEnabled: z.boolean().default(true),
  vibrationEnabled: z.boolean().default(true),
});

export async function prefsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/notification-preferences', async (req) => {
    const row = await queryOne(
      `SELECT min_risk_level AS "minRiskLevel", categories, tickers_only AS "tickersOnly",
              quiet_hours_start AS "quietHoursStart", quiet_hours_end AS "quietHoursEnd",
              timezone, sound_enabled AS "soundEnabled", vibration_enabled AS "vibrationEnabled"
       FROM notification_preferences WHERE user_id = $1`,
      [req.user.sub],
    );
    return row ?? prefsSchema.parse({});
  });

  app.put('/notification-preferences', async (req) => {
    const p = prefsSchema.parse(req.body);
    await query(
      `INSERT INTO notification_preferences
         (user_id, min_risk_level, categories, tickers_only, quiet_hours_start, quiet_hours_end, timezone, sound_enabled, vibration_enabled, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       ON CONFLICT (user_id) DO UPDATE SET
         min_risk_level = EXCLUDED.min_risk_level, categories = EXCLUDED.categories,
         tickers_only = EXCLUDED.tickers_only, quiet_hours_start = EXCLUDED.quiet_hours_start,
         quiet_hours_end = EXCLUDED.quiet_hours_end, timezone = EXCLUDED.timezone,
         sound_enabled = EXCLUDED.sound_enabled, vibration_enabled = EXCLUDED.vibration_enabled,
         updated_at = now()`,
      [req.user.sub, p.minRiskLevel, p.categories, p.tickersOnly, p.quietHoursStart, p.quietHoursEnd,
       p.timezone, p.soundEnabled, p.vibrationEnabled],
    );
    return p;
  });
}
