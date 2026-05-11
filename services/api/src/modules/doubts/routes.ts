import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';
import { retrieve } from '../../lib/rag.js';

const askSchema = z.object({
  courseId: z.string().uuid(),
  question: z.string().min(3),
});

export const registerDoubts: FastifyPluginAsync = async (app) => {
  app.get('/course/:courseId', async (req) => {
    await requireAuth(req);
    const { courseId } = req.params as { courseId: string };
    return prisma.doubt.findMany({
      where: { courseId },
      include: { student: { select: { id: true, name: true } } },
      orderBy: [{ upvotes: 'desc' }, { askedAt: 'desc' }],
      take: 100,
    });
  });

  app.post('/', async (req) => {
    const me = await requireAuth(req);
    const body = askSchema.parse(req.body);

    const enrolled = await prisma.enrollment.findFirst({
      where: { userId: me.id, courseId: body.courseId },
    });
    if (!enrolled) throw new AppError(403, 'NOT_ENROLLED', 'Not enrolled');

    const hits = await retrieve(body.question, [body.courseId], 4);
    let aiAnswer: string | null = null;
    if (hits.length > 0) {
      const context = hits
        .map((h, i) => `[${i + 1}] (Lec ${h.lectureId.slice(0, 6)} · ${Math.floor(h.startSec)}s) ${h.text}`)
        .join('\n\n');
      const res = await fetch(`${env.TRANSCRIPTION_URL}/api/notes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: `Answer using only the context below. Cite as [1] [2]. Keep under 4 sentences.\n\nCONTEXT:\n${context}\n\nQUESTION: ${body.question}`,
          type: 'summary',
          outputLanguage: 'en',
        }),
      });
      if (res.ok) aiAnswer = ((await res.json()) as { summary?: string }).summary ?? null;
    }

    return prisma.doubt.create({
      data: {
        studentId: me.id,
        courseId: body.courseId,
        question: body.question,
        aiAnswer,
        aiCitations: hits.map((h, i) => ({
          n: i + 1,
          lectureId: h.lectureId,
          startSec: h.startSec,
          endSec: h.endSec,
        })) as never,
      },
    });
  });

  app.post('/:id/upvote', async (req) => {
    await requireAuth(req);
    const { id } = req.params as { id: string };
    return prisma.doubt.update({ where: { id }, data: { upvotes: { increment: 1 } } });
  });

  app.post('/:id/resolve', async (req) => {
    const me = await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    return prisma.doubt.update({ where: { id }, data: { resolvedById: me.id } });
  });
};
