import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { signAccessToken, newRefreshToken, hashRefreshToken } from '../../lib/jwt.js';
import { badRequest, conflict, unauthorized } from '../../lib/errors.js';
import { requireAuth } from '../../lib/authPlugin.js';

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(60).optional(),
});

const refreshSchema = z.object({ refreshToken: z.string().min(20) });
const fcmSchema = z.object({ token: z.string().min(20).max(4096) });

interface UserRow { id: string; email: string; password_hash: string; role: 'user' | 'admin'; display_name: string | null }

async function issueTokens(userId: string, role: 'user' | 'admin') {
  const accessToken = signAccessToken({ sub: userId, role });
  const { token: refreshToken, hash } = newRefreshToken();
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '30 days')`,
    [userId, hash],
  );
  return { accessToken, refreshToken };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = credentialsSchema.parse(req.body);
    const existing = await queryOne(`SELECT 1 FROM users WHERE email = $1`, [body.email]);
    if (existing) throw conflict('Email already registered');
    const hash = await bcrypt.hash(body.password, 10);
    const user = await queryOne<{ id: string }>(
      `INSERT INTO users (email, password_hash, display_name) VALUES ($1,$2,$3) RETURNING id`,
      [body.email, hash, body.displayName ?? null],
    );
    if (!user) throw badRequest('Registration failed');
    await query(`INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]);
    const tokens = await issueTokens(user.id, 'user');
    return reply.code(201).send({ userId: user.id, ...tokens });
  });

  app.post('/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const body = credentialsSchema.pick({ email: true, password: true }).parse(req.body);
    const user = await queryOne<UserRow>(`SELECT * FROM users WHERE email = $1`, [body.email]);
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
      throw unauthorized('Invalid email or password');
    }
    const tokens = await issueTokens(user.id, user.role);
    return { userId: user.id, role: user.role, displayName: user.display_name, ...tokens };
  });

  app.post('/auth/refresh', async (req) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const hash = hashRefreshToken(refreshToken);
    const row = await queryOne<{ user_id: string; role: 'user' | 'admin' }>(
      `SELECT rt.user_id, u.role FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.revoked = FALSE AND rt.expires_at > now()`,
      [hash],
    );
    if (!row) throw unauthorized('Invalid refresh token');
    await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [hash]); // rotation
    return issueTokens(row.user_id, row.role);
  });

  app.post('/auth/fcm-token', { preHandler: requireAuth }, async (req) => {
    const { token } = fcmSchema.parse(req.body);
    await query(
      `UPDATE users SET fcm_tokens = array(SELECT DISTINCT t FROM unnest(array_append(fcm_tokens, $2)) t) WHERE id = $1`,
      [req.user.sub, token],
    );
    return { ok: true };
  });

  app.post('/auth/logout', { preHandler: requireAuth }, async (req) => {
    const body = z.object({ fcmToken: z.string().optional() }).parse(req.body ?? {});
    await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [req.user.sub]);
    if (body.fcmToken) {
      await query(
        `UPDATE users SET fcm_tokens = array(SELECT t FROM unnest(fcm_tokens) t WHERE t <> $2) WHERE id = $1`,
        [req.user.sub, body.fcmToken],
      );
    }
    return { ok: true };
  });
}
