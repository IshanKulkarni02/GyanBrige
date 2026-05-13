// Lecture auto-edit + chapter routes. Proxy to transcription service which
// owns ffmpeg + transcript segments. Chapters are persisted into Notes JSON;
// edited videos appear as `editedRecordingUrl` on the Lecture.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';

interface NotesJson {
  segments?: { start: number; end: number; text: string }[];
  chapters?: { startSec: number; title: string }[];
}

export const registerLectureEditing: FastifyPluginAsync = async (app) => {
  app.post('/:id/detect-chapters', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const notes = await prisma.notes.findUnique({ where: { lectureId: id } });
    if (!notes) throw new AppError(404, 'NO_NOTES', 'Notes not generated yet');
    const segments = (notes.contentJson as NotesJson).segments ?? [];
    const res = await fetch(`${env.TRANSCRIPTION_URL}/api/lectures/detect-chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments }),
    });
    if (!res.ok) throw new AppError(502, 'CHAPTER_FAIL', 'Transcription service failed');
    const { chapters } = (await res.json()) as { chapters: NotesJson['chapters'] };
    const merged = { ...(notes.contentJson as NotesJson), chapters };
    await prisma.notes.update({
      where: { lectureId: id },
      data: { contentJson: merged as never },
    });
    return { chapters };
  });

  app.post('/:id/auto-edit', async (req) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const lecture = await prisma.lecture.findUnique({
      where: { id },
      include: { notes: true },
    });
    if (!lecture?.recordingUrl) throw new AppError(409, 'NO_RECORDING', 'Recording not ready');
    const segments = ((lecture.notes?.contentJson as NotesJson)?.segments) ?? [];

    const res = await fetch(`${env.TRANSCRIPTION_URL}/api/lectures/auto-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath: lecture.recordingUrl, segments }),
    });
    if (!res.ok) throw new AppError(502, 'AUTOEDIT_FAIL', 'Auto-edit failed');
    const result = (await res.json()) as {
      output: string;
      originalDuration: number;
      editedDuration: number;
      cutCount: number;
    };

    await prisma.lecture.update({
      where: { id },
      data: { recordingUrl: result.output },
    });
    return result;
  });
};
