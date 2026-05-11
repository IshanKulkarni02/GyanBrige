import type { FastifyPluginAsync } from 'fastify';
import { Role } from '@prisma/client';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../../../env.js';
import { requireRole } from '../../../lib/role-guard.js';
import { AppError } from '../../../plugins/errors.js';

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue('bulk-import', { connection });

export const registerSisImport: FastifyPluginAsync = async (app) => {
  app.post('/', async (req) => {
    await requireRole(req, Role.ADMIN);
    const data = await req.file();
    if (!data) throw new AppError(400, 'NO_FILE', 'CSV file required');
    const buf = await data.toBuffer();
    if (buf.length > 5 * 1024 * 1024) throw new AppError(413, 'TOO_LARGE', 'CSV exceeds 5MB');
    const csv = buf.toString('utf8');
    const job = await queue.add('import', { csv }, { removeOnComplete: 50, removeOnFail: 50 });
    return { jobId: job.id };
  });

  app.get('/:jobId', async (req) => {
    await requireRole(req, Role.ADMIN);
    const { jobId } = req.params as { jobId: string };
    const job = await queue.getJob(jobId);
    if (!job) throw new AppError(404, 'NOT_FOUND', 'Job not found');
    return {
      id: job.id,
      state: await job.getState(),
      progress: job.progress,
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  });
};
