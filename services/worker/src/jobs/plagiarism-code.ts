// Code plagiarism: winnowing of normalized k-grams (Moss-style).
// 1. Shallow-clone the Git repo to /tmp.
// 2. Tokenize each tracked source file (drop comments/whitespace, rename idents).
// 3. Slide k-grams (k=5) → SHA1, winnow window (w=4) keeps smallest hash per window.
// 4. Compare fingerprint sets against prior submissions for the same assignment.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const K = 5;
const W = 4;
const CODE_EXT = new Set(['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.rb', '.cs', '.kt', '.swift']);

function listSource(root: string): string[] {
  const out: string[] = [];
  const walk = (p: string) => {
    for (const e of readdirSync(p)) {
      const full = path.join(p, e);
      if (e === '.git' || e === 'node_modules' || e.startsWith('.')) continue;
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (CODE_EXT.has(path.extname(e))) out.push(full);
    }
  };
  walk(root);
  return out;
}

function normalize(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/#.*$/gm, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, 'STR')
    .replace(/'(?:[^'\\]|\\.)*'/g, 'STR')
    .replace(/[A-Za-z_][A-Za-z_0-9]*/g, 'ID')
    .replace(/\d+/g, 'N')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function fingerprints(src: string): Set<string> {
  const norm = normalize(src);
  if (norm.length < K) return new Set([norm]);
  const grams: string[] = [];
  for (let i = 0; i <= norm.length - K; i++) {
    grams.push(crypto.createHash('sha1').update(norm.slice(i, i + K)).digest('hex').slice(0, 12));
  }
  const fps = new Set<string>();
  for (let i = 0; i <= grams.length - W; i++) {
    let min = grams[i]!;
    for (let j = 1; j < W; j++) if ((grams[i + j] ?? '') < min) min = grams[i + j]!;
    fps.add(min);
  }
  return fps;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / new Set([...a, ...b]).size;
}

export async function runCodePlagiarism(submissionId: string, gitUrl: string): Promise<unknown> {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'gb-plag-'));
  try {
    execFileSync('git', ['clone', '--depth=1', '--no-tags', gitUrl, tmp], {
      stdio: 'ignore',
      timeout: 60_000,
    });
    const files = listSource(tmp);
    const myFps = new Set<string>();
    for (const f of files.slice(0, 50)) {
      for (const fp of fingerprints(readFileSync(f, 'utf8'))) myFps.add(fp);
    }
    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { assignmentId: true, studentId: true },
    });
    if (!sub) return { skipped: 'gone' };

    const others = await prisma.submission.findMany({
      where: {
        assignmentId: sub.assignmentId,
        id: { not: submissionId },
        studentId: { not: sub.studentId },
        plagiarismReport: { not: null },
      },
      select: { id: true, studentId: true, plagiarismReport: true },
    });

    const matches: { submissionId: string; studentId: string; similarity: number }[] = [];
    for (const o of others) {
      const report = o.plagiarismReport as { fingerprints?: string[] } | null;
      if (!report?.fingerprints) continue;
      const sim = jaccard(myFps, new Set(report.fingerprints));
      if (sim > 0.25) matches.push({ submissionId: o.id, studentId: o.studentId, similarity: sim });
    }
    matches.sort((a, b) => b.similarity - a.similarity);

    const top = matches[0]?.similarity ?? 0;
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        plagiarismScore: top,
        plagiarismReport: {
          method: 'winnowing',
          fingerprints: Array.from(myFps).slice(0, 5000),
          matches: matches.slice(0, 10),
        } as never,
      },
    });
    return { top, matches: matches.length };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
