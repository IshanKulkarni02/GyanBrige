import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';

const timeRe = /^\d{2}:\d{2}$/;

const createSchema = z.object({
  courseId: z.string().uuid(),
  classroomId: z.string().uuid(),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRe),
  endTime: z.string().regex(timeRe),
});

export const registerTimetable: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const me = await requireAuth(req);
    const q = z
      .object({
        courseId: z.string().uuid().optional(),
        mine: z.coerce.boolean().optional(),
      })
      .parse(req.query);
    return prisma.timetable.findMany({
      where: {
        courseId: q.courseId,
        ...(q.mine
          ? {
              course: {
                OR: [
                  { teachers: { some: { id: me.id } } },
                  { enrollments: { some: { userId: me.id } } },
                ],
              },
            }
          : {}),
      },
      include: {
        course: { include: { subject: true, teachers: { select: { id: true, name: true } } } },
        classroom: true,
      },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
  });

  app.post('/', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    return prisma.timetable.create({ data: createSchema.parse(req.body) });
  });

  app.delete('/:id', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    await prisma.timetable.delete({ where: { id } });
    return { ok: true };
  });
};
