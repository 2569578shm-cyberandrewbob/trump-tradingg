import type { FastifyInstance } from 'fastify';
import { query } from '../../db/pool.js';
import { requireAuth } from '../../lib/authPlugin.js';

export async function sourceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/sources', { preHandler: requireAuth }, async () => {
    const rows = await query(
      `SELECT s.id, s.key, s.name, s.type, s.url, s.enabled,
              COALESCE(sr.reliability_score, 50) AS "reliabilityScore",
              COALESCE(sr.total_statements, 0) AS "totalStatements"
       FROM sources s LEFT JOIN source_reliability sr ON sr.source_id = s.id
       ORDER BY sr.reliability_score DESC NULLS LAST`,
    );
    return { sources: rows };
  });
}
