import { createHash } from 'node:crypto';
import { queryOne, query } from '../db/pool.js';
import { redis } from '../queue/queues.js';
import { env } from '../config/env.js';

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
  const cacheKey = `dedupe:${hash}`;

  if (await redis.get(cacheKey)) return { kind: 'exact-duplicate', hash };

  const exact = await queryOne<{ id: string }>(
    `SELECT id FROM raw_statements WHERE content_hash = $1`,
    [hash],
  );
  if (exact) {
    await redis.set(cacheKey, '1', 'EX', env.DEDUPE_WINDOW_HOURS * 3600);
    return { kind: 'exact-duplicate', hash };
  }

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
      // independent confirmation — strengthens the original statement
      await query(
        `UPDATE raw_statements SET confirmation_count = confirmation_count + 1 WHERE id = $1`,
        [near.id],
      );
    }
    return { kind: 'near-duplicate', hash, originalId: near.id };
  }

  await redis.set(cacheKey, '1', 'EX', env.DEDUPE_WINDOW_HOURS * 3600);
  return { kind: 'new', hash };
}
