import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import { query, queryOne } from '../db/pool.js';
import type { AiAnalysis, RiskLevel } from '../lib/types.js';
import { riskRank } from '../lib/types.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
import { parseAiResponse } from './schema.js';
import { classifyWithRules } from './rulesClassifier.js';

const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

export interface AnalyzeResult {
  analysis: AiAnalysis;
  engine: 'ai' | 'rules';
}

export async function analyzeStatement(
  rawStatementId: string,
  content: string,
  sourceName: string,
  statedAt: Date,
): Promise<AnalyzeResult> {
  const started = Date.now();
  if (anthropic) {
    try {
      const resp = await anthropic.messages.create({
        model: env.AI_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(content, sourceName, statedAt) }],
      });
      const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const parsed = parseAiResponse(text);
      await query(
        `INSERT INTO ai_analysis_logs (raw_statement_id, model, prompt_tokens, output_tokens, raw_response, valid_json, fallback_used, latency_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [rawStatementId, env.AI_MODEL, resp.usage.input_tokens, resp.usage.output_tokens, text, !!parsed, !parsed, Date.now() - started],
      );
      if (parsed) return { analysis: parsed, engine: 'ai' };
    } catch (err) {
      await query(
        `INSERT INTO ai_analysis_logs (raw_statement_id, model, raw_response, valid_json, fallback_used, latency_ms)
         VALUES ($1,$2,$3,FALSE,TRUE,$4)`,
        [rawStatementId, env.AI_MODEL, `ERROR: ${(err as Error).message}`, Date.now() - started],
      );
    }
  }
  return { analysis: classifyWithRules(content), engine: 'rules' };
}

/**
 * False-alert safeguard: an alert is "confirmed" only when its source is
 * reliable enough OR a second independent source reported the same statement.
 * Unconfirmed alerts are capped at Medium for notification purposes.
 */
export async function applySafeguards(
  analysis: AiAnalysis,
  rawStatementId: string,
): Promise<{ confirmed: boolean; effectiveRisk: RiskLevel }> {
  const row = await queryOne<{ reliability_score: number; confirmation_count: number }>(
    `SELECT COALESCE(sr.reliability_score, 50) AS reliability_score, rs.confirmation_count
     FROM raw_statements rs
     LEFT JOIN source_reliability sr ON sr.source_id = rs.source_id
     WHERE rs.id = $1`,
    [rawStatementId],
  );
  const reliability = row?.reliability_score ?? 50;
  const confirmations = row?.confirmation_count ?? 1;
  const confirmed = reliability >= env.MIN_RELIABILITY_FOR_CRITICAL || confirmations >= 2;

  let effectiveRisk = analysis.riskLevel;
  if (!confirmed && riskRank(effectiveRisk) > riskRank('Medium')) {
    effectiveRisk = 'Medium';
  }
  return { confirmed, effectiveRisk };
}

export async function persistAlert(
  rawStatementId: string,
  analysis: AiAnalysis,
  engine: 'ai' | 'rules',
): Promise<string | null> {
  const { confirmed, effectiveRisk } = await applySafeguards(analysis, rawStatementId);
  const title = confirmed ? analysis.notificationTitle : `UNCONFIRMED — ${analysis.notificationTitle}`;
  const alert = await queryOne<{ id: string }>(
    `INSERT INTO processed_alerts
       (raw_statement_id, is_market_relevant, risk_level, categories, summary, affected_sectors,
        sentiment, urgency_score, reasoning, notification_title, notification_body, confirmed, analysis_engine)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (raw_statement_id) DO NOTHING
     RETURNING id`,
    [
      rawStatementId, analysis.isMarketRelevant, effectiveRisk, analysis.categories, analysis.summary,
      analysis.affectedSectors, analysis.sentiment, analysis.urgencyScore, analysis.reasoning,
      title, analysis.notificationBody, confirmed, engine,
    ],
  );
  if (!alert) return null;
  for (const ticker of analysis.affectedTickers) {
    await query(`INSERT INTO alert_tickers (alert_id, ticker) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [alert.id, ticker]);
  }
  await query(`UPDATE raw_statements SET status = 'processed' WHERE id = $1`, [rawStatementId]);
  return alert.id;
}
