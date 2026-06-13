import { createHash } from 'node:crypto';
import { queryOne, query } from '../db/pool.js';
import { redis } from '../queue/queues.js';
import { env } from '../config/env.js';
import { promoteAlertIfConfirmed } from '../ai/analyzer.js';

/** Normalize text so trivial formatting differences hash identically. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')      // strip URLs
    .replace(/[“”"'’‘`]/g, '')           // strip quotes
    .replace(/[^\p{L}\p{N}%$ ]/gu, ' ')  // keep letters, digits, % and $
    .replace(/\s+/g, ' ')
    .trim();
}

export function contentHash(text: string): string {
  return createHash('sha256').update(normalizeText(text)).digest('hex');
}

export type DedupeResult =
  | { kind: 'new'; hash: string }
  | { kind: 'exact-duplicate'; hash: string }
  | { kind: 'near-duplicate'; hash: string; originalId: string };

/**
 * 3-layer dedupe:
 *  1. Redis hot cache of recent hashes (fast path)
 *  2. Exact hash match in raw_statements
 *  3. pg_trgm similarity against recent statements (cross-source near-duplicates)
 *
 * Near-duplicates from a different source CONFIRM the original
 * (confirmation_count++), which can lift an unconfirmed alert to confirmed.
 */
export async function checkDuplicate(text: string, sourceId: string): Promise<DedupeResult> {
  const hash = contentHash(text);
  const sourcesKey = `dedupe:${hash}:sources`;

  // 1. Redis check: Have we seen this exact hash from THIS source recently?
  if (await redis.sismember(sourcesKey, sourceId)) {
    return { kind: 'exact-duplicate', hash };
  }

  // 2. DB Exact Match: Have we seen this exact hash from ANY source?
  const exact = await queryOne<{ id: string; source_id: string }>(
    `SELECT id, source_id FROM raw_statements WHERE content_hash = $1`,
    [hash],
  );

  if (exact) {
    // If it's a DIFFERENT source, it's a confirmation
    if (exact.source_id !== sourceId) {
      await query(
        `UPDATE raw_statements SET confirmation_count = confirmation_count + 1 WHERE id = $1`,
        [exact.id],
      );
      await promoteAlertIfConfirmed(exact.id);
    }
    await redis.sadd(sourcesKey, sourceId);
    await redis.expire(sourcesKey, env.DEDUPE_WINDOW_HOURS * 3600);
    return { kind: 'exact-duplicate', hash };
  }

  // 3. DB Near Match: pg_trgm similarity against recent statements
  const near = await queryOne<{ id: string; source_id: string }>(
    `SELECT id, source_id FROM raw_statements
     WHERE detected_at > now() - ($2 || ' hours')::interval
       AND similarity(content, $1) >= $3
     ORDER BY similarity(content, $1) DESC
     LIMIT 1`,
    [text, String(env.DEDUPE_WINDOW_HOURS), env.DEDUPE_SIMILARITY_THRESHOLD],
  );

  if (near) {
    if (near.source_id !== sourceId) {
      await query(
        `UPDATE raw_statements SET confirmation_count = confirmation_count + 1 WHERE id = $1`,
        [near.id],
      );
      await promoteAlertIfConfirmed(near.id);
    }
    // We don't add to sourcesKey for near-duplicates because the content is slightly different,
    // and we want to allow other slightly different near-duplicates to also be confirmed
    // (or we could hash the original statement's hash).
    return { kind: 'near-duplicate', hash, originalId: near.id };
  }

  // 4. New statement
  await redis.sadd(sourcesKey, sourceId);
  await redis.expire(sourcesKey, env.DEDUPE_WINDOW_HOURS * 3600);
  return { kind: 'new', hash };
}
