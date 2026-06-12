import { z } from 'zod';
import { CATEGORIES, RISK_LEVELS, SENTIMENTS, type AiAnalysis } from '../lib/types.js';

export const aiAnalysisSchema = z.object({
  isMarketRelevant: z.boolean(),
  riskLevel: z.enum(RISK_LEVELS),
  categories: z.array(z.enum(CATEGORIES)).max(6),
  summary: z.string().min(1).max(600),
  affectedSectors: z.array(z.string().min(1)).max(10),
  affectedTickers: z.array(z.string().regex(/^[A-Z0-9.]{1,8}$/)).max(15),
  sentiment: z.enum(SENTIMENTS),
  urgencyScore: z.number().int().min(0).max(100),
  reasoning: z.string().max(1500),
  notificationTitle: z.string().min(1).max(80),
  notificationBody: z.string().min(1).max(200),
});

/** Parse raw LLM text into a validated AiAnalysis, or null if unusable. */
export function parseAiResponse(raw: string): AiAnalysis | null {
  // Tolerate accidental code fences or surrounding prose: extract first {...} block.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const result = aiAnalysisSchema.safeParse(obj);
  return result.success ? result.data : null;
}
