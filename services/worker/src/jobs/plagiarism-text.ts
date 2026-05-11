// Text plagiarism: 5-shingle MinHash signature + Jaccard estimate.
// O(n) per submission, cross-checks against all prior submissions of the
// same assignment. Fuzzy enough to catch paraphrase + reordering attempts.

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SHINGLE = 5;
const HASHES = 64;

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(text: string, k = SHINGLE): string[] {
  const t = tokens(text);
  if (t.length < k) return [t.join(' ')];
  const out: string[] = [];
  for (let i = 0; i <= t.length - k; i++) out.push(t.slice(i, i + k).join(' '));
  return out;
}

function minhash(sh: string[]): number[] {
  const sig: number[] = new Array(HASHES).fill(0xffffffff) as number[];
  for (const s of sh) {
    const base = crypto.createHash('sha256').update(s).digest();
    for (let i = 0; i < HASHES; i++) {
      const h = base.readUInt32BE((i * 4) % 28);
      if (h < (sig[i] ?? 0xffffffff)) sig[i] = h;
    }
  }
  return sig;
}

function jaccard(a: number[], b: number[]): number {
  let eq = 0;
  for (let i = 0; i < HASHES; i++) if (a[i] === b[i]) eq++;
  return eq / HASHES;
}

export async function runTextPlagiarism(submissionId: string): Promise<unknown> {
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, assignmentId: true, contentText: true, studentId: true },
  });
  if (!sub?.contentText) return { skipped: 'no text' };
  const others = await prisma.submission.findMany({
    where: {
      assignmentId: sub.assignmentId,
      id: { not: sub.id },
      studentId: { not: sub.studentId },
      contentText: { not: null },
    },
    select: { id: true, studentId: true, contentText: true },
  });

  const sigA = minhash(shingles(sub.contentText));
  const matches = others
    .map((o) => {
      const sim = jaccard(sigA, minhash(shingles(o.contentText ?? '')));
      return { submissionId: o.id, studentId: o.studentId, similarity: sim };
    })
    .filter((m) => m.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  const top = matches[0]?.similarity ?? 0;
  await prisma.submission.update({
    where: { id: sub.id },
    data: { plagiarismScore: top, plagiarismReport: { method: 'minhash', matches } as never },
  });
  return { top, matches: matches.length };
}
