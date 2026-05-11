import type { FastifyPluginAsync } from 'fastify';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireRole } from '../../lib/role-guard.js';

export const registerInvites: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    return prisma.inviteLink.findMany({
      include: {
        department: { select: { name: true } },
        course: { include: { subject: { select: { name: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.delete('/:id', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    await prisma.inviteLink.delete({ where: { id } });
    return { ok: true };
  });
};
