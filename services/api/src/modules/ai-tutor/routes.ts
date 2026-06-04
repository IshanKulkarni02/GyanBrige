// AI Tutor: ask a question, get an answer with citations linking back to
// lecture timestamps. Retrieval is scoped to courses the user is enrolled in.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { requireAuth } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';
import { retrieve, type RetrievalHit } from '../../lib/rag.js';

const askSchema = z.object({
  question: z.string().min(2),
  courseIds: z.array(z.string().uuid()).optional(),
});

async function answerFromContext(question: string, hits: RetrievalHit[]): Promise<string> {
  const context = hits
    .map(
      (h, i) =>
        `[${i + 1}] (Lec ${h.lectureId.slice(0, 6)} · ${Math.floor(h.startSec)}s) ${h.text}`,
    )
    .join('\n\n');
  const transcript = `Use the context below to answer. Cite sources as [1], [2]. Be concise.\n\nCONTEXT:\n${context}\n\nQUESTION: ${question}`;
  const res = await fetch(`${env.TRANSCRIPTION_URL}/api/notes/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, type: 'summary', outputLanguage: 'en' }),
  });
  if (!res.ok) return 'I could not generate an answer. Please try again.';
  const data = (await res.json()) as { summary?: string };
  return data.summary ?? 'No answer.';
}

export const registerAiTutor: FastifyPluginAsync = async (app) => {
  app.post('/ask', async (req) => {
    const me = await requireAuth(req);
    const body = askSchema.parse(req.body);

    const isAdmin = me.roles.includes(Role.ADMIN) || me.roles.includes(Role.STAFF);

    let courseIds: string[];
    if (isAdmin) {
      const all = await prisma.course.findMany({ select: { id: true } });
      courseIds = body.courseIds ?? all.map((c) => c.id);
    } else {
      const enrolled = await prisma.enrollment.findMany({
        where: { userId: me.id },
        select: { courseId: true },
      });
      const teaching = await prisma.course.findMany({
        where: { teachers: { some: { id: me.id } } },
        select: { id: true },
      });
      const allowed = [...new Set([...enrolled.map((e) => e.courseId), ...teaching.map((c) => c.id)])];
      courseIds = body.courseIds ? body.courseIds.filter((c) => allowed.includes(c)) : allowed;
      if (courseIds.length === 0) {
        throw new AppError(403, 'NO_COURSES', 'Enroll in a course before asking the tutor');
      }
    }

    const hits = await retrieve(body.question, courseIds, 6);
    const answer = await answerFromContext(body.question, hits);
    return {
      question: body.question,
      answer,
      citations: hits.map((h, i) => ({
        n: i + 1,
        lectureId: h.lectureId,
        startSec: h.startSec,
        endSec: h.endSec,
        snippet: h.text.slice(0, 240),
      })),
    };
  });

  app.post('/reindex/:lectureId', async (req) => {
    await requireAuth(req);
    const { lectureId } = req.params as { lectureId: string };
    const { Queue } = await import('bullmq');
    const { Redis } = await import('ioredis');
    const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const q = new Queue('embed-transcript', { connection });
    const job = await q.add('reindex', { lectureId });
    return { jobId: job.id };
  });
};
