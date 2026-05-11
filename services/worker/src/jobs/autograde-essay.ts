// AI essay autograder. Strictly teacher-in-loop: we score + explain, never
// auto-publish. Teacher reviews on the submission detail screen.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TX_URL = process.env.TRANSCRIPTION_URL ?? 'http://localhost:4001';

interface Criterion {
  id: string;
  label: string;
  weight: number;
  description?: string;
}

export async function runAutogradeEssay(submissionId: string): Promise<unknown> {
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: true },
  });
  if (!sub?.contentText || !sub.assignment.rubric) return { skipped: 'no text or rubric' };

  const criteria = ((sub.assignment.rubric as unknown as { criteria: Criterion[] }).criteria ?? []);
  if (criteria.length === 0) return { skipped: 'no rubric criteria' };

  const prompt = `Grade this student answer against the rubric. Return JSON: { perCriterion: [{ id, label, score(0-100), reasoning }], suggestion }.

RUBRIC:
${criteria.map((c) => `- [${c.id}] ${c.label} (${c.weight}%): ${c.description ?? ''}`).join('\n')}

ANSWER:
${sub.contentText.slice(0, 8000)}`;

  const res = await fetch(`${TX_URL}/api/notes/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript: prompt, type: 'full', outputLanguage: 'en' }),
  });
  if (!res.ok) return { error: `grader ${res.status}` };
  const data = await res.json();

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      feedback: typeof data === 'object' ? JSON.stringify(data) : String(data),
    },
  });
  return { ok: true };
}
