import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { NotesAuthor, Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

const SUPPORTED = ['en', 'hi', 'mr', 'ta', 'te', 'bn', 'gu', 'kn', 'ml', 'pa', 'ur'] as const;

const translateSchema = z.object({
  lang: z.enum(SUPPORTED),
  force: z.boolean().default(false),
});

async function assertLectureAccess(lectureId: string, userId: string, roles: Role[]) {
  if (roles.includes(Role.ADMIN) || roles.includes(Role.STAFF)) return;
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: {
      course: {
        select: {
          teachers: { select: { id: true } },
          enrollments: { where: { userId }, select: { id: true } },
        },
      },
    },
  });
  if (!lecture) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
  const ok =
    lecture.course.teachers.some((t) => t.id === userId) ||
    lecture.course.enrollments.length > 0;
  if (!ok) throw new AppError(403, 'FORBIDDEN', 'Not enrolled');
}

export const registerNotes: FastifyPluginAsync = async (app) => {
  app.get('/lecture/:lectureId', async (req) => {
    const me = await requireAuth(req);
    const { lectureId } = req.params as { lectureId: string };
    await assertLectureAccess(lectureId, me.id, me.roles);
    const notes = await prisma.notes.findUnique({
      where: { lectureId },
      include: {
        translations: {
          select: { id: true, lang: true, createdBy: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!notes) throw new AppError(404, 'NO_NOTES', 'Notes not generated yet');
    return notes;
  });

  app.get('/:notesId/translation', async (req) => {
    const me = await requireAuth(req);
    const { notesId } = req.params as { notesId: string };
    const { lang } = z.object({ lang: z.enum(SUPPORTED) }).parse(req.query);

    const notes = await prisma.notes.findUnique({
      where: { id: notesId },
      select: { id: true, contentJson: true, lectureId: true },
    });
    if (!notes) throw new AppError(404, 'NO_NOTES', 'Notes not found');
    await assertLectureAccess(notes.lectureId, me.id, me.roles);

    if (lang === 'en') {
      return { lang: 'en', contentJson: notes.contentJson, cached: true };
    }

    const cached = await prisma.notesTranslation.findUnique({
      where: { notesId_lang: { notesId, lang } },
    });
    if (cached) return { ...cached, cached: true };

    throw new AppError(404, 'NOT_TRANSLATED', 'Translation not yet generated — POST /translate first');
  });

  app.post('/:notesId/translate', async (req) => {
    const me = await requireAuth(req);
    const { notesId } = req.params as { notesId: string };
    const body = translateSchema.parse(req.body);

    const notes = await prisma.notes.findUnique({ where: { id: notesId } });
    if (!notes) throw new AppError(404, 'NO_NOTES', 'Notes not found');
    await assertLectureAccess(notes.lectureId, me.id, me.roles);

    if (!body.force) {
      const existing = await prisma.notesTranslation.findUnique({
        where: { notesId_lang: { notesId, lang: body.lang } },
      });
      if (existing) return { ...existing, cached: true };
    }

    const content = notes.contentJson as Record<string, unknown>;
    const sourceText = JSON.stringify(content);

    const res = await fetch(`${env.TRANSCRIPTION_URL}/api/notes/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: `${(content.title as string) ?? ''}\n${(content.summary as string) ?? ''}\n${sourceText}`,
        type: 'full',
        outputLanguage: body.lang,
      }),
    });
    if (!res.ok) throw new AppError(502, 'TRANSCRIPTION_FAILED', `Transcription service ${res.status}`);
    const payload = (await res.json()) as { title?: string; summary?: string; sections?: unknown[] };

    const saved = await prisma.notesTranslation.upsert({
      where: { notesId_lang: { notesId, lang: body.lang } },
      create: {
        notesId,
        lang: body.lang,
        contentJson: payload as never,
        createdBy: NotesAuthor.AI,
      },
      update: { contentJson: payload as never, createdBy: NotesAuthor.AI },
    });
    return { ...saved, cached: false };
  });

  app.delete('/:notesId/translation/:lang', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { notesId, lang } = req.params as { notesId: string; lang: string };
    await prisma.notesTranslation.delete({
      where: { notesId_lang: { notesId, lang } },
    });
    return { ok: true };
  });
};
