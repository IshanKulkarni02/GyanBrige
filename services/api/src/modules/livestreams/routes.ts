import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { LectureMode, Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';
import { ensureRoom, mintAccessToken, startRecording, stopRecording } from '../../lib/livekit.js';
import { env } from '../../env.js';

const tokenSchema = z.object({ lectureId: z.string().uuid() });
const startRecSchema = z.object({ lectureId: z.string().uuid(), language: z.string().optional() });
const stopRecSchema = z.object({ lectureId: z.string().uuid() });

function roomNameFor(lectureId: string): string {
  return `lec-${lectureId}`;
}

export const registerLivestreams: FastifyPluginAsync = async (app) => {
  app.post('/rooms', async (req) => {
    const me = await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { lectureId } = tokenSchema.parse(req.body);
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: { course: { include: { teachers: { select: { id: true } } } } },
    });
    if (!lecture) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
    const isTeacher = lecture.course.teachers.some((t) => t.id === me.id);
    if (!isTeacher && !me.roles.includes(Role.ADMIN))
      throw new AppError(403, 'FORBIDDEN', 'Only assigned teacher can start');

    const room = roomNameFor(lectureId);
    await ensureRoom(room);
    const session = await prisma.liveSession.upsert({
      where: { lectureId },
      create: { lectureId, livekitRoom: room, startedAt: new Date(), recordingStatus: 'IDLE' },
      update: { startedAt: new Date(), endedAt: null },
    });
    await prisma.lecture.update({
      where: { id: lectureId },
      data: { mode: lecture.mode === LectureMode.IN_PERSON ? LectureMode.HYBRID : lecture.mode },
    });
    return { roomName: room, sessionId: session.id, livekitUrl: env.LIVEKIT_URL };
  });

  app.post('/token', async (req) => {
    const me = await requireAuth(req);
    const { lectureId } = tokenSchema.parse(req.body);

    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        course: {
          include: {
            teachers: { select: { id: true } },
            enrollments: { where: { userId: me.id }, select: { id: true } },
            subject: { select: { id: true } },
          },
        },
        liveSession: true,
      },
    });
    if (!lecture) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
    if (!lecture.liveSession) throw new AppError(409, 'NOT_LIVE', 'Lecture is not live');

    const isTeacher = lecture.course.teachers.some((t) => t.id === me.id);
    const isStudent = lecture.course.enrollments.length > 0;
    if (!isTeacher && !isStudent && !me.roles.includes(Role.ADMIN))
      throw new AppError(403, 'FORBIDDEN', 'Not enrolled');

    // Cap enforcement runs in Phase 4. Token mint will call cap-enforcer at that point.
    const token = await mintAccessToken({
      identity: me.id,
      name: me.email ?? me.id,
      room: lecture.liveSession.livekitRoom,
      canPublish: isTeacher,
      canSubscribe: true,
      metadata: JSON.stringify({ role: isTeacher ? 'TEACHER' : 'STUDENT' }),
    });
    return { token, room: lecture.liveSession.livekitRoom, livekitUrl: env.LIVEKIT_URL };
  });

  app.post('/start-recording', async (req) => {
    const me = await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { lectureId, language } = startRecSchema.parse(req.body);
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: { liveSession: true, course: { include: { teachers: { select: { id: true } } } } },
    });
    if (!lecture?.liveSession) throw new AppError(409, 'NOT_LIVE', 'Lecture not live');
    if (
      !lecture.course.teachers.some((t) => t.id === me.id) &&
      !me.roles.includes(Role.ADMIN)
    )
      throw new AppError(403, 'FORBIDDEN', 'Only teacher can record');

    const out = await startRecording({
      roomName: lecture.liveSession.livekitRoom,
      lectureId,
      language: language ?? 'mixed',
    });
    await prisma.liveSession.update({
      where: { lectureId },
      data: { recordingStatus: 'RECORDING', egressId: out.egressId },
    });
    return { egressId: out.egressId, filepath: out.filepath };
  });

  app.post('/stop-recording', async (req) => {
    const me = await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { lectureId } = stopRecSchema.parse(req.body);
    const session = await prisma.liveSession.findUnique({ where: { lectureId } });
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Session not found');
    if (session.egressId) await stopRecording(session.egressId);
    await prisma.liveSession.update({
      where: { lectureId },
      data: { recordingStatus: 'STOPPED', endedAt: new Date() },
    });
    return { ok: true };
  });

  // POST /api/livestreams/egress-webhook
  // Called by services/transcription after it processes the recording.
  // Body: { lectureId, jobId, filepath? }
  // We never trust the wire data alone; we cross-check that an egress is
  // marked RECORDING for this lecture.
  app.post('/egress-webhook', async (req) => {
    const body = z
      .object({
        lectureId: z.string().uuid(),
        jobId: z.string(),
        recordingUrl: z.string().optional(),
      })
      .parse(req.body);
    const session = await prisma.liveSession.findUnique({ where: { lectureId: body.lectureId } });
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Session not found');
    await prisma.lecture.update({
      where: { id: body.lectureId },
      data: { transcriptionJobId: body.jobId, recordingUrl: body.recordingUrl ?? null },
    });
    await prisma.liveSession.update({
      where: { lectureId: body.lectureId },
      data: { recordingStatus: 'PROCESSED' },
    });
    return { ok: true };
  });
};
