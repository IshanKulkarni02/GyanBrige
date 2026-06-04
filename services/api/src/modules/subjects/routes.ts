import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';

const createSchema = z.object({
  code: z.string().min(2).max(16),
  name: z.string().min(2),
  deptId: z.string().uuid(),
  credits: z.number().int().min(0).max(20).default(3),
  semesterHint: z.number().int().min(1).max(12).optional(),
});

const updateSchema = createSchema.partial();

export const registerSubjects: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    await requireAuth(req);
    const q = z.object({ deptId: z.string().uuid().optional() }).parse(req.query);
    return prisma.subject.findMany({
      where: q.deptId ? { deptId: q.deptId } : undefined,
      orderBy: { code: 'asc' },
      include: { department: { select: { name: true } }, _count: { select: { courses: true } } },
    });
  });

  app.post('/', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    return prisma.subject.create({ data: createSchema.parse(req.body) });
  });

  app.put('/:id', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    return prisma.subject.update({ where: { id }, data: updateSchema.parse(req.body) });
  });

  app.delete('/:id', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    await prisma.subject.delete({ where: { id } });
    return { ok: true };
  });
};
