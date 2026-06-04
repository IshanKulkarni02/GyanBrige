import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';

const createSchema = z.object({
  name: z.string().min(1),
  building: z.string().optional(),
  capacity: z.number().int().min(1).max(2000).optional(),
});

export const registerClassrooms: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    await requireAuth(req);
    return prisma.classroom.findMany({ orderBy: [{ building: 'asc' }, { name: 'asc' }] });
  });

  app.post('/', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    return prisma.classroom.create({ data: createSchema.parse(req.body) });
  });

  app.put('/:id', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    return prisma.classroom.update({ where: { id }, data: createSchema.partial().parse(req.body) });
  });

  app.delete('/:id', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    await prisma.classroom.delete({ where: { id } });
    return { ok: true };
  });
};
