import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CapScope, Role } from '@prisma/client';
import { prisma } from '../../../db.js';
import { requireRole } from '../../../lib/role-guard.js';

const createSchema = z.object({
  scope: z.nativeEnum(CapScope),
  subjectId: z.string().uuid().optional(),
  maxOnlineLectures: z.number().int().min(0).max(10000),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});

export const registerCaps: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    return prisma.attendanceCap.findMany({
      include: { subject: { select: { code: true, name: true } } },
      orderBy: [{ scope: 'asc' }, { periodStart: 'desc' }],
    });
  });

  app.post('/', async (req) => {
    await requireRole(req, Role.ADMIN);
    const body = createSchema.parse(req.body);
    if (body.scope === CapScope.SUBJECT && !body.subjectId)
      throw new Error('subjectId required for SUBJECT scope');
    return prisma.attendanceCap.upsert({
      where: {
        scope_subjectId_periodStart: {
          scope: body.scope,
          subjectId: body.scope === CapScope.GLOBAL ? null : body.subjectId!,
          periodStart: body.periodStart,
        },
      },
      create: {
        scope: body.scope,
        subjectId: body.scope === CapScope.GLOBAL ? null : body.subjectId!,
        maxOnlineLectures: body.maxOnlineLectures,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
      },
      update: {
        maxOnlineLectures: body.maxOnlineLectures,
        periodEnd: body.periodEnd,
      },
    });
  });

  app.delete('/:id', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    await prisma.attendanceCap.delete({ where: { id } });
    return { ok: true };
  });
};
