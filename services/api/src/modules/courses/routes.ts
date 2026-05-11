import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const createSchema = z.object({
  subjectId: z.string().uuid(),
  semester: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  teacherIds: z.array(z.string().uuid()).default([]),
  room: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  teacherIds: z.array(z.string().uuid()).optional(),
});

export const registerCourses: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const me = await requireAuth(req);
    const q = z
      .object({
        subjectId: z.string().uuid().optional(),
        mine: z.coerce.boolean().optional(),
      })
      .parse(req.query);
    return prisma.course.findMany({
      where: {
        subjectId: q.subjectId,
        ...(q.mine
          ? {
              OR: [
                { teachers: { some: { id: me.id } } },
                { enrollments: { some: { userId: me.id } } },
              ],
            }
          : {}),
      },
      include: {
        subject: { include: { department: true } },
        teachers: { select: { id: true, name: true } },
        _count: { select: { enrollments: true, lectures: true } },
      },
      orderBy: [{ year: 'desc' }, { semester: 'desc' }],
    });
  });

  app.get('/:id', async (req) => {
    await requireAuth(req);
    const { id } = req.params as { id: string };
    return prisma.course.findUniqueOrThrow({
      where: { id },
      include: {
        subject: { include: { department: true } },
        teachers: { select: { id: true, name: true, email: true } },
        timetables: { include: { classroom: true } },
        _count: { select: { enrollments: true, lectures: true, assignments: true, tests: true } },
      },
    });
  });

  app.post('/', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const body = createSchema.parse(req.body);
    return prisma.course.create({
      data: {
        subjectId: body.subjectId,
        semester: body.semester,
        year: body.year,
        room: body.room,
        teachers: { connect: body.teacherIds.map((id) => ({ id })) },
      },
      include: { teachers: true, subject: true },
    });
  });

  app.put('/:id', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const body = updateSchema.parse(req.body);
    return prisma.course.update({
      where: { id },
      data: {
        subjectId: body.subjectId,
        semester: body.semester,
        year: body.year,
        room: body.room,
        teachers: body.teacherIds
          ? { set: body.teacherIds.map((tid) => ({ id: tid })) }
          : undefined,
      },
      include: { teachers: true, subject: true },
    });
  });

  app.delete('/:id', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    await prisma.course.delete({ where: { id } });
    return { ok: true };
  });

  app.post('/:id/enroll', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF, Role.TEACHER);
    const { id } = req.params as { id: string };
    const { studentIds } = z
      .object({ studentIds: z.array(z.string().uuid()).min(1) })
      .parse(req.body);
    const created = await prisma.$transaction(
      studentIds.map((userId) =>
        prisma.enrollment.upsert({
          where: { userId_courseId: { userId, courseId: id } },
          create: { userId, courseId: id },
          update: {},
        }),
      ),
    );
    return { count: created.length };
  });

  app.delete('/:id/enroll/:userId', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF, Role.TEACHER);
    const { id, userId } = req.params as { id: string; userId: string };
    await prisma.enrollment.delete({
      where: { userId_courseId: { userId, courseId: id } },
    });
    return { ok: true };
  });

  app.get('/:id/students', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const course = await prisma.course.findUnique({
      where: { id },
      include: { teachers: { select: { id: true } } },
    });
    if (!course) throw new AppError(404, 'NOT_FOUND', 'Course not found');
    const isTeacher = course.teachers.some((t) => t.id === me.id);
    const isAdmin = me.roles.includes(Role.ADMIN) || me.roles.includes(Role.STAFF);
    if (!isTeacher && !isAdmin) throw new AppError(403, 'FORBIDDEN', 'Not allowed');
    return prisma.enrollment.findMany({
      where: { courseId: id, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });
  });
};
