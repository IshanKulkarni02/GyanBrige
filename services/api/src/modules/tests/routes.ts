import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  AttemptStatus,
  ProctoringEventType,
  QuestionType,
  Role,
} from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const testCreateSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(2),
  duration: z.number().int().min(1).max(360),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
  settings: z
    .object({
      shuffleQuestions: z.boolean().default(false),
      shuffleOptions: z.boolean().default(false),
      lockdown: z.boolean().default(true),
      strictProctoring: z.boolean().default(false),
      webcamRequired: z.boolean().default(false),
      allowedAttempts: z.number().int().min(1).max(5).default(1),
    })
    .default({}),
});

const questionSchema = z.object({
  type: z.nativeEnum(QuestionType),
  prompt: z.string(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.unknown().optional(),
  points: z.number().int().min(1).max(100).default(1),
});

const proctorSchema = z.object({
  attemptId: z.string().uuid(),
  type: z.nativeEnum(ProctoringEventType),
  severity: z.number().int().min(1).max(5).default(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

function autoGrade(type: QuestionType, correct: unknown, answer: unknown): number | null {
  if (correct == null) return null;
  switch (type) {
    case QuestionType.MCQ:
      return answer === correct ? 1 : 0;
    case QuestionType.MSQ: {
      const a = Array.isArray(answer) ? new Set(answer as string[]) : new Set<string>();
      const c = Array.isArray(correct) ? new Set(correct as string[]) : new Set<string>();
      if (a.size !== c.size) return 0;
      for (const v of a) if (!c.has(v)) return 0;
      return 1;
    }
    case QuestionType.SHORT: {
      const a = String(answer ?? '').trim().toLowerCase();
      const c = String(correct ?? '').trim().toLowerCase();
      return a && a === c ? 1 : 0;
    }
    default:
      return null;
  }
}

export const registerTests: FastifyPluginAsync = async (app) => {
  app.get('/course/:courseId', async (req) => {
    await requireAuth(req);
    const { courseId } = req.params as { courseId: string };
    return prisma.test.findMany({
      where: { courseId },
      include: { _count: { select: { questions: true, attempts: true } } },
      orderBy: { opensAt: 'desc' },
    });
  });

  app.post('/', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const body = testCreateSchema.parse(req.body);
    return prisma.test.create({ data: body });
  });

  app.post('/:testId/questions', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { testId } = req.params as { testId: string };
    const body = questionSchema.parse(req.body);
    const last = await prisma.testQuestion.findFirst({
      where: { testId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return prisma.testQuestion.create({
      data: {
        testId,
        order: (last?.order ?? 0) + 1,
        type: body.type,
        prompt: body.prompt,
        options: body.options as never,
        correctAnswer: body.correctAnswer as never,
        points: body.points,
      },
    });
  });

  app.post('/:testId/start', async (req) => {
    const me = await requireAuth(req);
    const { testId } = req.params as { testId: string };
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { questions: true },
    });
    if (!test) throw new AppError(404, 'NOT_FOUND', 'Test not found');
    const now = new Date();
    if (test.opensAt > now || test.closesAt < now)
      throw new AppError(409, 'TEST_CLOSED', 'Test not open right now');

    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: me.id, courseId: test.courseId } },
    });
    if (!enrolled) throw new AppError(403, 'NOT_ENROLLED', 'Not enrolled');

    const settings = (test.settings ?? {}) as { allowedAttempts?: number };
    const allowed = settings.allowedAttempts ?? 1;

    const existing = await prisma.testAttempt.findUnique({
      where: { testId_studentId: { testId, studentId: me.id } },
    });
    if (existing && existing.status !== AttemptStatus.IN_PROGRESS && allowed <= 1)
      throw new AppError(409, 'ALREADY_ATTEMPTED', 'Already submitted');

    const attempt = existing
      ? existing
      : await prisma.testAttempt.create({
          data: { testId, studentId: me.id, status: AttemptStatus.IN_PROGRESS },
        });

    let questions = test.questions.map((q) => ({
      id: q.id,
      order: q.order,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      points: q.points,
    }));
    if ((test.settings as { shuffleQuestions?: boolean })?.shuffleQuestions) {
      questions = [...questions].sort(() => Math.random() - 0.5);
    }
    return { attempt, questions, durationSec: test.duration * 60, settings: test.settings };
  });

  app.post('/attempts/:id/answer', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const body = z
      .object({ questionId: z.string().uuid(), answer: z.unknown() })
      .parse(req.body);

    const attempt = await prisma.testAttempt.findUnique({ where: { id } });
    if (!attempt || attempt.studentId !== me.id)
      throw new AppError(403, 'FORBIDDEN', 'Not your attempt');
    if (attempt.status !== AttemptStatus.IN_PROGRESS)
      throw new AppError(409, 'SUBMITTED', 'Attempt already submitted');

    const q = await prisma.testQuestion.findUnique({ where: { id: body.questionId } });
    if (!q) throw new AppError(404, 'NOT_FOUND', 'Question not found');

    const graded = autoGrade(q.type, q.correctAnswer, body.answer);
    return prisma.testAnswer.upsert({
      where: { attemptId_questionId: { attemptId: id, questionId: body.questionId } },
      create: {
        attemptId: id,
        questionId: body.questionId,
        answer: body.answer as never,
        score: graded != null ? graded * q.points : null,
        autoGraded: graded != null,
      },
      update: {
        answer: body.answer as never,
        score: graded != null ? graded * q.points : null,
        autoGraded: graded != null,
      },
    });
  });

  app.post('/attempts/:id/submit', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const attempt = await prisma.testAttempt.findUnique({
      where: { id },
      include: { answers: true },
    });
    if (!attempt || attempt.studentId !== me.id)
      throw new AppError(403, 'FORBIDDEN', 'Not your attempt');
    const score = attempt.answers.reduce((s, a) => s + (a.score ?? 0), 0);
    return prisma.testAttempt.update({
      where: { id },
      data: { status: AttemptStatus.SUBMITTED, submittedAt: new Date(), score },
    });
  });

  app.post('/proctoring-events', async (req) => {
    const me = await requireAuth(req);
    const body = proctorSchema.parse(req.body);
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: body.attemptId },
      select: { studentId: true, status: true },
    });
    if (!attempt || attempt.studentId !== me.id)
      throw new AppError(403, 'FORBIDDEN', 'Not your attempt');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) return { skipped: true };

    return prisma.proctoringEvent.create({
      data: {
        attemptId: body.attemptId,
        type: body.type,
        severity: body.severity,
        payload: body.payload as never,
      },
    });
  });

  app.get('/attempts/:id/proctoring', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const attempt = await prisma.testAttempt.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, name: true } },
        proctoringLog: { orderBy: { at: 'asc' } },
      },
    });
    if (!attempt) throw new AppError(404, 'NOT_FOUND', 'Attempt not found');
    return attempt;
  });
};
