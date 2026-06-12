import type { FastifyRequest } from 'fastify';
import { verifyAccessToken, type AccessPayload } from './jwt.js';
import { unauthorized, forbidden } from './errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AccessPayload;
  }
}

export async function requireAuth(req: FastifyRequest): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized('Missing bearer token');
  req.user = verifyAccessToken(header.slice(7));
}

export async function requireAdmin(req: FastifyRequest): Promise<void> {
  await requireAuth(req);
  if (req.user.role !== 'admin') throw forbidden('Admin access required');
}
