import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { requireAuth } from '../../lib/authPlugin.js';

const tickerSchema = z.string().regex(/^[A-Za-z0-9.]{1,8}$/, 'Invalid ticker').transform((t) => t.toUpperCase());

export async function watchlistRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/watchlist', async (req) => {
    const rows = await query<{ ticker: string }>(
      `SELECT ticker FROM watchlists WHERE user_id = $1 ORDER BY ticker`,
      [req.user.sub],
    );
    return { tickers: rows.map((r) => r.ticker) };
  });

  app.post('/watchlist', async (req, reply) => {
    const { ticker } = z.object({ ticker: tickerSchema }).parse(req.body);
    await query(
      `INSERT INTO watchlists (user_id, ticker) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.user.sub, ticker],
    );
    return reply.code(201).send({ ticker });
  });

  app.delete('/watchlist/:ticker', async (req) => {
    const { ticker } = z.object({ ticker: tickerSchema }).parse(req.params);
    await query(`DELETE FROM watchlists WHERE user_id = $1 AND ticker = $2`, [req.user.sub, ticker]);
    return { ok: true };
  });
}
