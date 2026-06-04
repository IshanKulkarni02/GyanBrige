import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';

const createSchema = z.object({
  name: z.string().min(2),
  headId: z.string().uuid().optional(),
});

const updateSchema = createSchema.partial();

async function singletonCollegeId(): Promise<string> {
  const c = await prisma.college.findFirst({ select: { id: true } });
  if (c) return c.id;
  const created = await prisma.college.create({
    data: { name: 'GyanBrige', domains: [] },
  });
  return created.id;
}

export const registerDepartments: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    await requireAuth(req);
    return prisma.department.findMany({
      include: { _count: { select: { subjects: true } }, head: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  });

  app.post('/', async (req) => {
    await requireRole(req, Role.ADMIN);
    const body = createSchema.parse(req.body);
    const collegeId = await singletonCollegeId();
    return prisma.department.create({ data: { ...body, collegeId } });
  });

  app.put('/:id', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    const body = updateSchema.parse(req.body);
    return prisma.department.update({ where: { id }, data: body });
  });

  app.delete('/:id', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    await prisma.department.delete({ where: { id } });
    return { ok: true };
  });
};
