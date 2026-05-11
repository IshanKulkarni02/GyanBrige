// Weekly study plan generator. Pulls last 4 weeks of:
// - attendance (missed lectures → review topics)
// - quiz scores (low autoGraded → weak topics)
// - flashcard misses (last result < 3 → weak topics)
// Builds a checklist + per-day schedule, persists in StudyPlan.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PlanItem {
  day: number;
  durationMin: number;
  task: string;
  why: string;
}

export async function runGenerateStudyPlan(
  studentId: string,
  courseId: string,
): Promise<{ items: number; weak: string[] }> {
  const since = new Date(Date.now() - 28 * 24 * 3600 * 1000);

  const [missed, lowScores, flashMisses, recentLectures] = await Promise.all([
    prisma.lecture.findMany({
      where: {
        courseId,
        scheduledAt: { gte: since, lte: new Date() },
        attendances: { none: { studentId } },
      },
      select: { id: true, title: true },
      take: 8,
    }),
    prisma.testAnswer.findMany({
      where: {
        attempt: { studentId, test: { courseId } },
        autoGraded: true,
        score: { lt: 0.5 },
      },
      include: { question: { select: { prompt: true } } },
      take: 12,
    }),
    prisma.flashcardReview.findMany({
      where: {
        studentId,
        lastResult: { in: ['0', '1', '2'] },
        card: { lecture: { courseId } },
      },
      include: { card: { select: { front: true, back: true } } },
      take: 12,
    }),
    prisma.lecture.findMany({
      where: { courseId, scheduledAt: { gte: since } },
      select: { id: true, title: true },
      orderBy: { scheduledAt: 'desc' },
      take: 6,
    }),
  ]);

  const weak: string[] = [];
  const items: PlanItem[] = [];

  let day = 1;
  for (const lec of missed) {
    items.push({
      day,
      durationMin: 30,
      task: `Catch up: watch "${lec.title}"`,
      why: 'You were marked absent for this lecture',
    });
    weak.push(lec.title);
    day++;
    if (day > 7) day = 1;
  }
  for (const a of lowScores) {
    items.push({
      day,
      durationMin: 15,
      task: `Review concept: ${a.question.prompt.slice(0, 80)}`,
      why: 'Scored below 50% on this quiz question',
    });
    weak.push(a.question.prompt.slice(0, 40));
    day = (day % 7) + 1;
  }
  for (const r of flashMisses) {
    items.push({
      day,
      durationMin: 5,
      task: `Re-drill: ${r.card.front}`,
      why: 'You missed this flashcard',
    });
    day = (day % 7) + 1;
  }
  if (items.length === 0 && recentLectures.length > 0) {
    for (const lec of recentLectures.slice(0, 3)) {
      items.push({
        day: day++,
        durationMin: 20,
        task: `Skim notes for "${lec.title}"`,
        why: 'Routine review',
      });
    }
  }

  const planJson = { items, generatedFor: 'next-7-days' };

  await prisma.studyPlan.create({
    data: { studentId, courseId, planJson: planJson as never, weakTopics: weak.slice(0, 20) },
  });
  return { items: items.length, weak: weak.slice(0, 5) };
}
