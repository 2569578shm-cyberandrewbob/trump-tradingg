import pg from 'pg';
import { env } from '../config/env.js';

// Managed Postgres (Neon, Supabase, Render, Railway, …) requires TLS. Enable it
// when the URL asks for SSL or points at a known managed host; off for local.
const dbUrl = env.DATABASE_URL;
const needsSsl = /sslmode=require|neon\.tech|supabase\.|render\.com|railway|koyeb|amazonaws\.com/i.test(dbUrl);

export const pool = new pg.Pool({
  connectionString: dbUrl,
  max: env.FREE_TIER_MODE === 'true' ? 5 : 10,
  idleTimeoutMillis: 30_000,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
