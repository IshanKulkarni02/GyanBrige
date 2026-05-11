import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const upsertSchema = z.object({
  courseId: z.string().uuid(),
  studentId: z.string().uuid(),
  semester: z.number().int().min(1).max(12),
  components: z.record(z.string(), z.number()),
  gpa: z.number().optional(),
  sgpa: z.number().optional(),
  publish: z.boolean().default(false),
});

export const registerResults: FastifyPluginAsync = async (app) => {
  app.get('/me', async (req) => {
    const me = await requireAuth(req);
    return prisma.result.findMany({
      where: { studentId: me.id, publishedAt: { not: null } },
      include: { course: { include: { subject: true } } },
      orderBy: [{ semester: 'desc' }, { publishedAt: 'desc' }],
    });
  });

  app.get('/student/:studentId', async (req) => {
    const me = await requireAuth(req);
    const { studentId } = req.params as { studentId: string };
    const isSelf = studentId === me.id;
    const isStaff = me.roles.includes(Role.ADMIN) || me.roles.includes(Role.STAFF) || me.roles.includes(Role.TEACHER);
    if (!isSelf && !isStaff) throw new AppError(403, 'FORBIDDEN', 'Not allowed');
    return prisma.result.findMany({
      where: { studentId, ...(isSelf ? { publishedAt: { not: null } } : {}) },
      include: { course: { include: { subject: true } } },
    });
  });

  app.post('/', async (req) => {
    const me = await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const body = upsertSchema.parse(req.body);

    const existing = await prisma.result.findUnique({
      where: {
        courseId_studentId_semester: {
          courseId: body.courseId,
          studentId: body.studentId,
          semester: body.semester,
        },
      },
    });

    const result = await prisma.result.upsert({
      where: {
        courseId_studentId_semester: {
          courseId: body.courseId,
          studentId: body.studentId,
          semester: body.semester,
        },
      },
      create: {
        courseId: body.courseId,
        studentId: body.studentId,
        semester: body.semester,
        components: body.components as never,
        gpa: body.gpa,
        sgpa: body.sgpa,
        publishedAt: body.publish ? new Date() : null,
      },
      update: {
        components: body.components as never,
        gpa: body.gpa,
        sgpa: body.sgpa,
        publishedAt: body.publish ? new Date() : null,
      },
    });

    await prisma.gradeAudit.create({
      data: {
        resultId: result.id,
        byId: me.id,
        change: {
          before: existing
            ? { components: existing.components, gpa: existing.gpa, sgpa: existing.sgpa }
            : null,
          after: { components: body.components, gpa: body.gpa, sgpa: body.sgpa, published: body.publish },
        } as never,
      },
    });

    return result;
  });

  app.get('/:id/audit', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF, Role.TEACHER);
    const { id } = req.params as { id: string };
    return prisma.gradeAudit.findMany({
      where: { resultId: id },
      include: { by: { select: { id: true, name: true } } },
      orderBy: { at: 'desc' },
    });
  });
};
