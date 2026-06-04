// Auto-generate flashcards from a lecture's notes.
// Pulls structured notes (sections → key terms / takeaways), turns each into
// a Q/A pair via the transcription service's notes endpoint, then upserts.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TX_URL = process.env.TRANSCRIPTION_URL ?? 'http://localhost:4001';

interface NotesShape {
  sections?: { heading: string; content?: string[]; keyTerms?: string[] }[];
  keyTakeaways?: string[];
}

interface Card {
  front: string;
  back: string;
}

function cardsFromNotes(notes: NotesShape): Card[] {
  const out: Card[] = [];
  for (const sec of notes.sections ?? []) {
    if (sec.keyTerms?.length) {
      for (const term of sec.keyTerms) {
        out.push({ front: `Define: ${term}`, back: `${term} (from “${sec.heading}”)` });
      }
    }
    for (const bullet of sec.content ?? []) {
      const idx = bullet.indexOf(':');
      if (idx > 2 && idx < bullet.length - 3) {
        out.push({ front: bullet.slice(0, idx).trim() + '?', back: bullet.slice(idx + 1).trim() });
      }
    }
  }
  for (const t of notes.keyTakeaways ?? []) {
    out.push({ front: `Key takeaway from this lecture?`, back: t });
  }
  return out;
}

export async function runFlashcardGen(lectureId: string): Promise<{ created: number }> {
  const notes = await prisma.notes.findUnique({ where: { lectureId } });
  if (!notes) return { created: 0 };
  let cards = cardsFromNotes(notes.contentJson as NotesShape);

  if (cards.length === 0) {
    const res = await fetch(`${TX_URL}/api/notes/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: JSON.stringify(notes.contentJson),
        type: 'keypoints',
        outputLanguage: 'en',
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { keyPoints?: string[] };
      cards = (data.keyPoints ?? []).map((p) => ({ front: `What does this mean?`, back: p }));
    }
  }

  if (cards.length === 0) return { created: 0 };

  await prisma.$transaction(
    cards.slice(0, 50).map((card) =>
      prisma.flashcard.create({
        data: { lectureId, front: card.front, back: card.back },
      }),
    ),
  );
  return { created: cards.length };
}
