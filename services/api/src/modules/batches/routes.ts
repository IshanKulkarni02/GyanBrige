// College batch (cohort) management.
// A Batch is a group of students in the same programme year, e.g.
// "Computer Science 2022-26" or "Mechanical Engineering 2nd Year".
// Batches can be bulk-enrolled into all courses for a given semester.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const createSchema = z.object({
  name: z.string().min(2),
  programmeCode: z.string().min(2),
  deptId: z.string().uuid(),
  startYear: z.number().int().min(2000).max(2100),
  graduationYear: z.number().int().min(2000).max(2100),
  currentSemester: z.number().int().min(1).max(12).default(1),
});

const bulkEnrollSchema = z.object({
  courseIds: z.array(z.string().uuid()).min(1),
});

export const registerBatches: FastifyPluginAsync = async (app) => {
  // List all batches (optionally filtered by department)
  app.get('/', async (req) => {
    await requireAuth(req);
    const { deptId } = z.object({ deptId: z.string().uuid().optional() }).parse(req.query);
    return prisma.batch.findMany({
      where: deptId ? { deptId } : undefined,
      include: {
        department: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ startYear: 'desc' }, { name: 'asc' }],
    });
  });

  // Get a single batch with its students — restricted to admin/staff
  app.get('/:id', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        department: { select: { name: true } },
        enrollments: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            course: { include: { subject: { select: { code: true, name: true } } } },
          },
        },
      },
    });
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
    return batch;
  });

  // List students in a batch (unique, without per-course duplication)
  app.get('/:id/students', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const enrollments = await prisma.enrollment.findMany({
      where: { batchId: id },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      distinct: ['userId'],
    });
    return enrollments.map((e) => e.user);
  });

  // Create a batch
  app.post('/', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const body = createSchema.parse(req.body);
    if (body.graduationYear <= body.startYear) {
      throw new AppError(400, 'BAD_DATA', 'graduationYear must be after startYear');
    }
    return prisma.batch.create({ data: body });
  });

  // Update semester or name
  app.patch('/:id', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(2).optional(),
      currentSemester: z.number().int().min(1).max(12).optional(),
    }).parse(req.body);
    return prisma.batch.update({ where: { id }, data: body });
  });

  // Bulk-enroll all students in this batch into a set of courses
  app.post('/:id/enroll', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const { courseIds } = bulkEnrollSchema.parse(req.body);

    const batch = await prisma.batch.findUnique({
      where: { id },
      include: { enrollments: { select: { userId: true }, distinct: ['userId'] } },
    });
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');

    const studentIds = [...new Set(batch.enrollments.map((e) => e.userId))];
    if (studentIds.length === 0) throw new AppError(409, 'EMPTY_BATCH', 'No students in this batch yet');

    const records = studentIds.flatMap((userId) =>
      courseIds.map((courseId) => ({ userId, courseId, batchId: id })),
    );

    const result = await prisma.$transaction(
      records.map((r) =>
        prisma.enrollment.upsert({
          where: { userId_courseId: { userId: r.userId, courseId: r.courseId } },
          create: r,
          update: { batchId: id },
        }),
      ),
    );
    return { enrolled: result.length };
  });

  // Add individual students to a batch (links their existing enrollments to this batch)
  app.post('/:id/add-students', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const { studentIds } = z.object({ studentIds: z.array(z.string().uuid()).min(1) }).parse(req.body);

    await prisma.batch.findUniqueOrThrow({ where: { id } });

    // Update all enrollments for these students to belong to this batch
    const updated = await prisma.enrollment.updateMany({
      where: { userId: { in: studentIds } },
      data: { batchId: id },
    });
    return { updated: updated.count };
  });

  app.delete('/:id', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    await prisma.batch.delete({ where: { id } });
    return { ok: true };
  });
};
