// Translate a batch of caption segments for a given lecture into a target language.
// Segments are read from Notes.contentJson.segments (set by the transcription pipeline).
// Translated segments are stored back under Notes.contentJson.translations[lang].
// The captions-translate queue is enqueued from the livestream pipeline once a
// teacher enables live caption translation for their session.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TX_URL = process.env.TRANSCRIPTION_URL ?? 'http://localhost:4001';

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface NotesJson {
  segments?: Segment[];
  chapters?: unknown[];
  translations?: Record<string, Segment[]>;
  [key: string]: unknown;
}

async function translateText(text: string, targetLanguage: string): Promise<string> {
  const res = await fetch(`${TX_URL}/api/notes/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: text,
      type: 'full',
      outputLanguage: targetLanguage,
    }),
  });
  if (!res.ok) throw new Error(`Transcription service returned ${res.status}`);
  const data = (await res.json()) as { notes?: string; content?: string } | string;
  if (typeof data === 'string') return data;
  return data.notes ?? data.content ?? text;
}

export async function runCaptionsTranslate(
  lectureId: string,
  targetLanguage: string,
): Promise<{ translated: number; language: string }> {
  const notes = await prisma.notes.findUnique({ where: { lectureId } });
  if (!notes) return { translated: 0, language: targetLanguage };

  const json = (notes.contentJson ?? {}) as NotesJson;
  const segments = json.segments ?? [];
  if (segments.length === 0) return { translated: 0, language: targetLanguage };

  // Already translated — skip
  const existing = json.translations?.[targetLanguage];
  if (existing && existing.length === segments.length) {
    return { translated: segments.length, language: targetLanguage };
  }

  // Batch segments into chunks of ~5 to limit API calls while keeping context
  const BATCH = 5;
  const translated: Segment[] = [];
  for (let i = 0; i < segments.length; i += BATCH) {
    const batch = segments.slice(i, i + BATCH);
    const combined = batch.map((s) => s.text).join('\n');
    let result: string;
    try {
      result = await translateText(combined, targetLanguage);
    } catch {
      // On error, keep original text so the job doesn't fail hard
      result = combined;
    }
    const lines = result.split('\n');
    batch.forEach((seg, idx) => {
      translated.push({
        start: seg.start,
        end: seg.end,
        text: lines[idx]?.trim() || seg.text,
      });
    });
  }

  const translations = { ...(json.translations ?? {}), [targetLanguage]: translated };
  await prisma.notes.update({
    where: { lectureId },
    data: { contentJson: { ...json, translations } as never },
  });

  return { translated: translated.length, language: targetLanguage };
}
