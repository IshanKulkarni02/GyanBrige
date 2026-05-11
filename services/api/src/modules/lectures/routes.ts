import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { LectureMode, Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const createSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(2),
  scheduledAt: z.coerce.date(),
  mode: z.nativeEnum(LectureMode).default(LectureMode.IN_PERSON),
});

async function assertCourseAccess(userId: string, roles: Role[], courseId: string) {
  const admin = roles.includes(Role.ADMIN) || roles.includes(Role.STAFF);
  if (admin) return;
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      OR: [{ teachers: { some: { id: userId } } }, { enrollments: { some: { userId } } }],
    },
    select: { id: true },
  });
  if (!course) throw new AppError(403, 'FORBIDDEN', 'Not part of this course');
}

export const registerLectures: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const me = await requireAuth(req);
    const q = z
      .object({
        courseId: z.string().uuid().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
      .parse(req.query);
    if (q.courseId) await assertCourseAccess(me.id, me.roles, q.courseId);
    return prisma.lecture.findMany({
      where: {
        courseId: q.courseId,
        scheduledAt: { gte: q.from, lte: q.to },
        ...(q.courseId
          ? {}
          : {
              course: {
                OR: [
                  { teachers: { some: { id: me.id } } },
                  { enrollments: { some: { userId: me.id } } },
                ],
              },
            }),
      },
      include: {
        liveSession: true,
        course: { include: { subject: { select: { code: true, name: true } } } },
        _count: { select: { attendances: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  });

  app.get('/:id', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const lecture = await prisma.lecture.findUnique({
      where: { id },
      include: {
        liveSession: true,
        course: { include: { subject: true, teachers: { select: { id: true } } } },
        notes: true,
      },
    });
    if (!lecture) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
    await assertCourseAccess(me.id, me.roles, lecture.courseId);
    return lecture;
  });

  app.post('/', async (req) => {
    const me = await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const body = createSchema.parse(req.body);
    await assertCourseAccess(me.id, me.roles, body.courseId);
    return prisma.lecture.create({ data: body });
  });

  app.delete('/:id', async (req) => {
    const me = await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const lec = await prisma.lecture.findUnique({ where: { id } });
    if (!lec) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
    await assertCourseAccess(me.id, me.roles, lec.courseId);
    await prisma.lecture.delete({ where: { id } });
    return { ok: true };
  });
};
