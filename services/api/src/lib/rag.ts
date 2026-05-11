// Lightweight RAG over lecture transcripts.
// - Chunks transcript into ~300-token windows with overlap.
// - Embeds via transcription service (proxies to configured backend).
// - Stores vectors in pgvector; retrieves top-k via cosine distance.

import { prisma } from '../db.js';
import { env } from '../env.js';

const CHUNK_TOK = 300;
const CHUNK_OVERLAP = 50;

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface Chunk {
  index: number;
  text: string;
  startSec: number;
  endSec: number;
}

export function chunkTranscript(segments: TranscriptSegment[]): Chunk[] {
  const out: Chunk[] = [];
  let buf: string[] = [];
  let bufStart = segments[0]?.start ?? 0;
  let bufEnd = bufStart;
  let approxTok = 0;

  const flush = () => {
    if (buf.length === 0) return;
    out.push({ index: out.length, text: buf.join(' '), startSec: bufStart, endSec: bufEnd });
  };

  for (const seg of segments) {
    if (approxTok === 0) bufStart = seg.start;
    buf.push(seg.text);
    bufEnd = seg.end;
    approxTok += Math.ceil(seg.text.split(/\s+/).length * 1.3);
    if (approxTok >= CHUNK_TOK) {
      flush();
      const overlap = buf.slice(Math.max(0, buf.length - CHUNK_OVERLAP / 5));
      buf = [...overlap];
      approxTok = overlap.join(' ').split(/\s+/).length;
    }
  }
  flush();
  return out;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${env.TRANSCRIPTION_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) {
    // Fallback: simple hash embedding so search still works without backend
    return texts.map(hashEmbed);
  }
  const data = (await res.json()) as { vectors: number[][] };
  return data.vectors;
}

function hashEmbed(text: string): number[] {
  const dim = 1536;
  const v = new Array(dim).fill(0) as number[];
  for (const w of text.toLowerCase().split(/\s+/)) {
    let h = 0;
    for (let i = 0; i < w.length; i++) h = (h * 31 + w.charCodeAt(i)) | 0;
    const idx = Math.abs(h) % dim;
    v[idx] = (v[idx] ?? 0) + 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export async function indexLecture(
  lectureId: string,
  segments: TranscriptSegment[],
): Promise<number> {
  const chunks = chunkTranscript(segments);
  if (chunks.length === 0) return 0;
  const vectors = await embed(chunks.map((c) => c.text));
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "TranscriptEmbedding" WHERE "lectureId" = ${lectureId}`,
    ...chunks.map((chunk, i) =>
      prisma.$executeRawUnsafe(
        `INSERT INTO "TranscriptEmbedding" (id, "lectureId", "chunkIndex", text, "startSec", "endSec", embedding)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::vector)`,
        lectureId,
        chunk.index,
        chunk.text,
        chunk.startSec,
        chunk.endSec,
        `[${vectors[i]!.join(',')}]`,
      ),
    ),
  ]);
  return chunks.length;
}

export interface RetrievalHit {
  lectureId: string;
  chunkIndex: number;
  text: string;
  startSec: number;
  endSec: number;
  distance: number;
}

export async function retrieve(
  query: string,
  courseIds: string[],
  k = 6,
): Promise<RetrievalHit[]> {
  const [vector] = await embed([query]);
  if (!vector || courseIds.length === 0) return [];
  const lectureIds = (
    await prisma.lecture.findMany({
      where: { courseId: { in: courseIds } },
      select: { id: true },
    })
  ).map((l) => l.id);
  if (lectureIds.length === 0) return [];

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT "lectureId", "chunkIndex", text, "startSec", "endSec",
            embedding <=> $1::vector AS distance
       FROM "TranscriptEmbedding"
      WHERE "lectureId" = ANY($2::text[])
      ORDER BY distance ASC
      LIMIT $3`,
    `[${vector.join(',')}]`,
    lectureIds,
    k,
  )) as RetrievalHit[];
  return rows;
}
