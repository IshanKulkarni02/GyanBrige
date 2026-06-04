// Flashcard SR review (SM-2 lite).
// Worker generates cards from notes; this surface handles review + scheduling.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { requireAuth } from '../../lib/role-guard.js';

const reviewSchema = z.object({
  cardId: z.string().uuid(),
  quality: z.number().int().min(0).max(5),
});

function sm2(prev: { ease: number; interval: number }, quality: number) {
  let ease = prev.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  if (ease < 1.3) ease = 1.3;
  let interval = prev.interval;
  if (quality < 3) interval = 1;
  else if (prev.interval === 0) interval = 1;
  else if (prev.interval === 1) interval = 6;
  else interval = Math.round(prev.interval * ease);
  return { ease, interval };
}

export const registerFlashcards: FastifyPluginAsync = async (app) => {
  app.get('/due', async (req) => {
    const me = await requireAuth(req);
    return prisma.flashcardReview.findMany({
      where: { studentId: me.id, dueAt: { lte: new Date() } },
      include: {
        card: {
          include: { lecture: { select: { id: true, title: true, course: { select: { subjectId: true } } } } },
        },
      },
      orderBy: { dueAt: 'asc' },
      take: 40,
    });
  });

  app.post('/review', async (req) => {
    const me = await requireAuth(req);
    const body = reviewSchema.parse(req.body);
    const cur = await prisma.flashcardReview.findUnique({
      where: { cardId_studentId: { cardId: body.cardId, studentId: me.id } },
    });
    const next = sm2(
      { ease: cur?.easeFactor ?? 2.5, interval: cur?.interval ?? 0 },
      body.quality,
    );
    const dueAt = new Date(Date.now() + next.interval * 24 * 3600 * 1000);
    return prisma.flashcardReview.upsert({
      where: { cardId_studentId: { cardId: body.cardId, studentId: me.id } },
      create: {
        cardId: body.cardId,
        studentId: me.id,
        easeFactor: next.ease,
        interval: next.interval,
        dueAt,
        lastResult: body.quality.toString(),
      },
      update: {
        easeFactor: next.ease,
        interval: next.interval,
        dueAt,
        lastResult: body.quality.toString(),
      },
    });
  });
};
