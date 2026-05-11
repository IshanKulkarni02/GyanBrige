// Study plan: lists current plans + lets a student trigger regeneration.
// Heavy generation runs in services/worker (queue: generate-study-plan).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { requireAuth } from '../../lib/role-guard.js';

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue('generate-study-plan', { connection });

export const registerStudyPlan: FastifyPluginAsync = async (app) => {
  app.get('/me', async (req) => {
    const me = await requireAuth(req);
    return prisma.studyPlan.findMany({
      where: { studentId: me.id },
      include: { course: { include: { subject: { select: { code: true, name: true } } } } },
      orderBy: { generatedAt: 'desc' },
    });
  });

  app.post('/regenerate', async (req) => {
    const me = await requireAuth(req);
    const { courseId } = z.object({ courseId: z.string().uuid() }).parse(req.body);
    const job = await queue.add('gen', { studentId: me.id, courseId });
    return { jobId: job.id };
  });
};
