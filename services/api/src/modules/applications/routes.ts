// Application forms (add/drop, leave, bonafide, custom).
// Workflow is a JSON state machine: { steps: [{ id, approverRole, approverId? }] }.
// Each step transitions IN_REVIEW → APPROVED/REJECTED; final step publishes.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApplicationStatus, Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const formSchema = z.object({
  kind: z.string().min(1),
  name: z.string().min(2),
  schema: z.object({
    fields: z.array(
      z.object({
        id: z.string(),
        type: z.enum(['text', 'long', 'number', 'date', 'select', 'file']),
        label: z.string(),
        options: z.array(z.string()).optional(),
        required: z.boolean().default(false),
      }),
    ),
  }),
  workflow: z.object({
    steps: z.array(
      z.object({
        id: z.string(),
        approverRole: z.nativeEnum(Role),
        approverScope: z.string().optional(),
      }),
    ),
  }),
});

const applySchema = z.object({
  formId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
});

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().optional(),
});

interface Workflow {
  steps: { id: string; approverRole: Role; approverScope?: string }[];
}

interface HistoryEntry {
  stepId: string;
  by: string;
  decision: 'APPROVED' | 'REJECTED';
  note?: string;
  at: string;
}

async function findApprover(role: Role, scope?: string): Promise<string | null> {
  const r = await prisma.userRole.findFirst({
    where: { role, scopeId: scope ?? null },
    select: { userId: true },
  });
  return r?.userId ?? null;
}

export const registerApplications: FastifyPluginAsync = async (app) => {
  app.get('/forms', async (req) => {
    await requireAuth(req);
    return prisma.applicationForm.findMany({ orderBy: { name: 'asc' } });
  });

  app.post('/forms', async (req) => {
    await requireRole(req, Role.ADMIN, Role.STAFF);
    return prisma.applicationForm.create({ data: formSchema.parse(req.body) });
  });

  app.delete('/forms/:id', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { id } = req.params as { id: string };
    await prisma.applicationForm.delete({ where: { id } });
    return { ok: true };
  });

  app.post('/', async (req) => {
    const me = await requireAuth(req);
    const body = applySchema.parse(req.body);
    const form = await prisma.applicationForm.findUnique({ where: { id: body.formId } });
    if (!form) throw new AppError(404, 'NOT_FOUND', 'Form not found');
    const wf = form.workflow as unknown as Workflow;
    const firstStep = wf.steps[0];
    if (!firstStep) throw new AppError(409, 'BAD_WORKFLOW', 'Form has no approval steps');
    const approver = await findApprover(firstStep.approverRole, firstStep.approverScope);

    return prisma.application.create({
      data: {
        kind: form.kind,
        formId: form.id,
        applicantId: me.id,
        payload: body.payload as never,
        status: ApplicationStatus.IN_REVIEW,
        currentApproverId: approver,
        history: [] as never,
      },
    });
  });

  app.get('/mine', async (req) => {
    const me = await requireAuth(req);
    return prisma.application.findMany({
      where: { applicantId: me.id },
      include: { form: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.get('/inbox', async (req) => {
    const me = await requireAuth(req);
    return prisma.application.findMany({
      where: { currentApproverId: me.id, status: ApplicationStatus.IN_REVIEW },
      include: {
        form: { select: { name: true, workflow: true } },
        applicant: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post('/:id/decide', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const body = decisionSchema.parse(req.body);

    const appli = await prisma.application.findUnique({
      where: { id },
      include: { form: { select: { workflow: true } } },
    });
    if (!appli) throw new AppError(404, 'NOT_FOUND', 'Application not found');
    if (appli.currentApproverId !== me.id)
      throw new AppError(403, 'FORBIDDEN', 'Not your approval');
    if (appli.status !== ApplicationStatus.IN_REVIEW)
      throw new AppError(409, 'NOT_ACTIVE', 'Application not active');

    const wf = appli.form.workflow as unknown as Workflow;
    const history = (appli.history as unknown as HistoryEntry[]) ?? [];
    const stepIdx = history.length;
    const currentStep = wf.steps[stepIdx]!;
    history.push({
      stepId: currentStep.id,
      by: me.id,
      decision: body.decision,
      note: body.note,
      at: new Date().toISOString(),
    });

    if (body.decision === 'REJECTED') {
      return prisma.application.update({
        where: { id },
        data: {
          status: ApplicationStatus.REJECTED,
          currentApproverId: null,
          history: history as never,
        },
      });
    }

    const nextStep = wf.steps[stepIdx + 1];
    if (!nextStep) {
      return prisma.application.update({
        where: { id },
        data: {
          status: ApplicationStatus.APPROVED,
          currentApproverId: null,
          history: history as never,
        },
      });
    }
    const nextApprover = await findApprover(nextStep.approverRole, nextStep.approverScope);
    return prisma.application.update({
      where: { id },
      data: { currentApproverId: nextApprover, history: history as never },
    });
  });
};
