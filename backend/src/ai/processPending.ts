import { query } from '../db/pool.js';
import { analyzeStatement, persistAlert } from './analyzer.js';

interface PendingRow {
  id: string;
  content: string;
  stated_at: Date;
  source_name: string;
}

/**
 * Synchronously analyze all pending raw statements (same logic as the BullMQ
 * analyze worker, run inline). Returns the ids of alerts created for
 * market-relevant statements. Used by the one-shot verification runner so the
 * full pipeline can be proven deterministically without queue timing.
 */
export async function processPending(): Promise<{ alertIds: string[]; processed: number }> {
  const rows = await query<PendingRow>(
    `SELECT rs.id, rs.content, rs.stated_at, s.name AS source_name
     FROM raw_statements rs JOIN sources s ON s.id = rs.source_id
     WHERE rs.status = 'pending'
     ORDER BY rs.detected_at ASC`,
  );

  const alertIds: string[] = [];
  for (const r of rows) {
    const { analysis, engine } = await analyzeStatement(r.id, r.content, r.source_name, r.stated_at);
    const alertId = await persistAlert(r.id, analysis, engine);
    if (alertId && analysis.isMarketRelevant) alertIds.push(alertId);
  }
  return { alertIds, processed: rows.length };
}
