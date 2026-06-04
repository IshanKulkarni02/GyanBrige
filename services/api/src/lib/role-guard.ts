import type { Role } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { AppError } from '../plugins/errors.js';
import type { JwtPayload } from './jwt.js';

export async function requireAuth(req: FastifyRequest): Promise<JwtPayload> {
  try {
    await req.jwtVerify();
    return req.user as JwtPayload;
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Login required');
  }
}

export async function requireRole(req: FastifyRequest, ...allowed: Role[]): Promise<JwtPayload> {
  const user = await requireAuth(req);
  const ok = user.roles.some((r) => allowed.includes(r));
  if (!ok) throw new AppError(403, 'FORBIDDEN', 'Insufficient role');
  return user;
}
