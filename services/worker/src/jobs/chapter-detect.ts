// Detect "chapters" inside a lecture transcript so the recording player can
// show jump-to markers. Pure heuristic: find topic-shift segments via
// cosine-distance spikes between adjacent embedding chunks.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Embedding {
  chunkIndex: number;
  startSec: number;
  endSec: number;
  text: string;
  embedding: number[];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    na += (a[i] ?? 0) ** 2;
    nb += (b[i] ?? 0) ** 2;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export async function runChapterDetect(lectureId: string): Promise<{ chapters: number }> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT "chunkIndex", "startSec", "endSec", text, embedding::text AS embedding
       FROM "TranscriptEmbedding"
      WHERE "lectureId" = $1
      ORDER BY "chunkIndex" ASC`,
    lectureId,
  )) as { chunkIndex: number; startSec: number; endSec: number; text: string; embedding: string }[];

  if (rows.length < 3) return { chapters: 0 };

  const chunks: Embedding[] = rows.map((r) => ({
    chunkIndex: r.chunkIndex,
    startSec: r.startSec,
    endSec: r.endSec,
    text: r.text,
    embedding: JSON.parse(r.embedding.replace(/^\[|\]$/g, '[').replace(/^\[/, '[')) as number[],
  }));

  const chapters: { startSec: number; title: string }[] = [
    { startSec: chunks[0]!.startSec, title: chunks[0]!.text.split(/[.?!]/)[0]!.slice(0, 60) },
  ];
  for (let i = 1; i < chunks.length; i++) {
    const sim = cosine(chunks[i - 1]!.embedding, chunks[i]!.embedding);
    if (sim < 0.55) {
      chapters.push({
        startSec: chunks[i]!.startSec,
        title: chunks[i]!.text.split(/[.?!]/)[0]!.slice(0, 60),
      });
    }
  }

  const notes = await prisma.notes.findUnique({ where: { lectureId } });
  if (notes) {
    const existing = (notes.contentJson as Record<string, unknown>) ?? {};
    await prisma.notes.update({
      where: { lectureId },
      data: { contentJson: { ...existing, chapters } as never },
    });
  }
  return { chapters: chapters.length };
}
