import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireRole } from '../../lib/role-guard.js';

const listQuery = z.object({
  actorId: z.string().uuid().optional(),
  resource: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const registerAudit: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    await requireRole(req, Role.ADMIN);
    const q = listQuery.parse(req.query);
    const rows = await prisma.auditLog.findMany({
      where: {
        actorId: q.actorId,
        resource: q.resource ? { contains: q.resource } : undefined,
      },
      take: q.limit + 1,
      cursor: q.cursor ? { id: q.cursor } : undefined,
      skip: q.cursor ? 1 : 0,
      orderBy: { at: 'desc' },
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
    const nextCursor = rows.length > q.limit ? rows.pop()!.id : null;
    return { entries: rows, nextCursor };
  });
};
