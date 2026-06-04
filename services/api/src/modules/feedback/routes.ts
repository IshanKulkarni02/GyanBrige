import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { NoticeScope, Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const formSchema = z.object({
  scope: z.nativeEnum(NoticeScope),
  targetId: z.string().uuid().optional(),
  title: z.string().min(2),
  schema: z.object({
    questions: z
      .array(
        z.object({
          id: z.string(),
          type: z.enum(['scale', 'choice', 'text']),
          prompt: z.string(),
          options: z.array(z.string()).optional(),
          required: z.boolean().default(false),
        }),
      )
      .min(1),
  }),
  anonymous: z.boolean().default(true),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
});

const responseSchema = z.object({
  formId: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
});

export const registerFeedback: FastifyPluginAsync = async (app) => {
  app.get('/forms', async (req) => {
    await requireAuth(req);
    const now = new Date();
    return prisma.feedbackForm.findMany({
      where: { opensAt: { lte: now }, closesAt: { gte: now } },
      orderBy: { closesAt: 'asc' },
    });
  });

  app.post('/forms', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    return prisma.feedbackForm.create({ data: formSchema.parse(req.body) });
  });

  app.delete('/forms/:id', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    await prisma.feedbackForm.delete({ where: { id } });
    return { ok: true };
  });

  app.post('/responses', async (req) => {
    const me = await requireAuth(req);
    const body = responseSchema.parse(req.body);
    const form = await prisma.feedbackForm.findUnique({ where: { id: body.formId } });
    if (!form) throw new AppError(404, 'NOT_FOUND', 'Form not found');
    const now = new Date();
    if (form.opensAt > now || form.closesAt < now)
      throw new AppError(409, 'FORM_CLOSED', 'Form is not open');

    return prisma.feedbackResponse.create({
      data: {
        formId: body.formId,
        userId: form.anonymous ? null : me.id,
        answers: body.answers as never,
      },
    });
  });

  app.get('/forms/:id/responses', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    return prisma.feedbackResponse.findMany({
      where: { formId: id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { submittedAt: 'desc' },
    });
  });
};
