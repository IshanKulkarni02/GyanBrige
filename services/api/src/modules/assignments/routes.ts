import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { Role, SubmissionStatus } from '@prisma/client';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const plagTextQueue = new Queue('plagiarism-text', { connection: redis });
const plagCodeQueue = new Queue('plagiarism-code', { connection: redis });

const createSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(2),
  brief: z.string().min(2),
  dueAt: z.coerce.date(),
  allowsLate: z.boolean().default(false),
  lateWindowHours: z.number().int().min(0).max(720).default(24),
  maxScore: z.number().int().min(1).max(1000).default(100),
  rubric: z
    .object({
      criteria: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          weight: z.number().min(0).max(100),
          description: z.string().optional(),
        }),
      ),
    })
    .optional(),
  submissionTypes: z.array(z.enum(['FILE', 'TEXT', 'CODE', 'GIT'])).default(['FILE', 'TEXT']),
  peerReview: z.boolean().default(false),
});

const submitSchema = z.object({
  contentText: z.string().optional(),
  files: z.array(z.object({ name: z.string(), url: z.string() })).default([]),
  gitRepoUrl: z.string().url().optional(),
});

const gradeSchema = z.object({
  score: z.number(),
  feedback: z.string().optional(),
});

const peerSchema = z.object({
  reviewerCount: z.number().int().min(1).max(5).default(2),
});

export const registerAssignments: FastifyPluginAsync = async (app) => {
  app.get('/course/:courseId', async (req) => {
    const me = await requireAuth(req);
    const { courseId } = req.params as { courseId: string };
    return prisma.assignment.findMany({
      where: { courseId },
      include: {
        _count: { select: { submissions: true } },
        submissions: {
          where: { studentId: me.id },
          select: { id: true, status: true, score: true, submittedAt: true },
        },
      },
      orderBy: { dueAt: 'asc' },
    });
  });

  app.get('/:id', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const a = await prisma.assignment.findUnique({
      where: { id },
      include: {
        course: { include: { subject: true, teachers: { select: { id: true } } } },
        submissions: {
          where: { studentId: me.id },
          include: { reviews: true },
        },
      },
    });
    if (!a) throw new AppError(404, 'NOT_FOUND', 'Assignment not found');
    return a;
  });

  app.post('/', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const body = createSchema.parse(req.body);
    return prisma.assignment.create({ data: body as never });
  });

  app.delete('/:id', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    await prisma.assignment.delete({ where: { id } });
    return { ok: true };
  });

  app.post('/:id/submissions', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const body = submitSchema.parse(req.body);

    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) throw new AppError(404, 'NOT_FOUND', 'Assignment not found');

    const now = new Date();
    const past = now > assignment.dueAt;
    if (past && !assignment.allowsLate)
      throw new AppError(409, 'PAST_DUE', 'Assignment is past due');
    const lateCap = new Date(assignment.dueAt.getTime() + assignment.lateWindowHours * 3600 * 1000);
    if (past && now > lateCap)
      throw new AppError(409, 'LATE_WINDOW_CLOSED', 'Late submission window closed');

    const sub = await prisma.submission.upsert({
      where: { assignmentId_studentId: { assignmentId: id, studentId: me.id } },
      create: {
        assignmentId: id,
        studentId: me.id,
        contentText: body.contentText,
        files: body.files as never,
        gitRepoUrl: body.gitRepoUrl,
        status: past ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
        submittedAt: now,
      },
      update: {
        contentText: body.contentText,
        files: body.files as never,
        gitRepoUrl: body.gitRepoUrl,
        status: past ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
        submittedAt: now,
      },
    });

    if (body.contentText && body.contentText.length > 200) {
      await plagTextQueue.add('check', { submissionId: sub.id }, { removeOnComplete: 50 });
    }
    if (body.gitRepoUrl) {
      await plagCodeQueue.add('check', { submissionId: sub.id, gitUrl: body.gitRepoUrl }, { removeOnComplete: 50 });
    }

    return sub;
  });

  app.get('/:id/submissions', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    return prisma.submission.findMany({
      where: { assignmentId: id },
      include: { student: { select: { id: true, name: true, email: true } }, reviews: true },
      orderBy: { submittedAt: 'asc' },
    });
  });

  app.post('/submissions/:id/grade', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const body = gradeSchema.parse(req.body);
    return prisma.submission.update({
      where: { id },
      data: { score: body.score, feedback: body.feedback, status: SubmissionStatus.GRADED },
    });
  });

  app.post('/:id/peer-allocate', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const body = peerSchema.parse(req.body);

    const subs = await prisma.submission.findMany({
      where: { assignmentId: id, status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE] } },
      select: { id: true, studentId: true },
    });
    if (subs.length < 2) throw new AppError(409, 'NOT_ENOUGH', 'Need at least 2 submissions');

    // Double-blind round-robin
    const shuffled = [...subs].sort(() => Math.random() - 0.5);
    const allocations = [];
    for (let i = 0; i < shuffled.length; i++) {
      const sub = shuffled[i]!;
      for (let k = 1; k <= body.reviewerCount; k++) {
        const reviewer = shuffled[(i + k) % shuffled.length]!;
        if (reviewer.studentId === sub.studentId) continue;
        allocations.push({ submissionId: sub.id, reviewerId: reviewer.studentId });
      }
    }

    const created = await prisma.$transaction(
      allocations.map((a) =>
        prisma.peerReview.upsert({
          where: { submissionId_reviewerId: a },
          create: a,
          update: {},
        }),
      ),
    );
    return { count: created.length };
  });

  app.post('/peer-reviews/:id', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const body = z.object({ score: z.number(), comments: z.string().optional() }).parse(req.body);
    const review = await prisma.peerReview.findUnique({ where: { id } });
    if (!review) throw new AppError(404, 'NOT_FOUND', 'Review not found');
    if (review.reviewerId !== me.id) throw new AppError(403, 'FORBIDDEN', 'Not your review');
    return prisma.peerReview.update({
      where: { id },
      data: { score: body.score, comments: body.comments, status: 'SUBMITTED', submittedAt: new Date() },
    });
  });

  app.get('/peer-reviews/me', async (req) => {
    const me = await requireAuth(req);
    return prisma.peerReview.findMany({
      where: { reviewerId: me.id },
      include: {
        submission: {
          include: {
            assignment: { include: { course: { include: { subject: true } } } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  });
};
