import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { LectureMode, Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';
import { minio, BUCKET, ensureBucket, publicUrl } from '../../lib/storage.js';

const createSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(2),
  scheduledAt: z.coerce.date(),
  mode: z.nativeEnum(LectureMode).default(LectureMode.IN_PERSON),
});

async function assertCourseAccess(userId: string, roles: Role[], courseId: string) {
  const admin = roles.includes(Role.ADMIN) || roles.includes(Role.STAFF);
  if (admin) return;
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      OR: [{ teachers: { some: { id: userId } } }, { enrollments: { some: { userId } } }],
    },
    select: { id: true },
  });
  if (!course) throw new AppError(403, 'FORBIDDEN', 'Not part of this course');
}

export const registerLectures: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const me = await requireAuth(req);
    const q = z
      .object({
        courseId: z.string().uuid().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
      .parse(req.query);
    if (q.courseId) await assertCourseAccess(me.id, me.roles, q.courseId);
    const isAdmin = me.roles.includes(Role.ADMIN) || me.roles.includes(Role.STAFF);
    return prisma.lecture.findMany({
      where: {
        courseId: q.courseId,
        scheduledAt: { gte: q.from, lte: q.to },
        ...(q.courseId || isAdmin
          ? {}
          : {
              course: {
                OR: [
                  { teachers: { some: { id: me.id } } },
                  { enrollments: { some: { userId: me.id } } },
                ],
              },
            }),
      },
      include: {
        liveSession: true,
        course: { include: { subject: { select: { code: true, name: true } } } },
        _count: { select: { attendances: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  });

  app.get('/:id', async (req) => {
    const me = await requireAuth(req);
    const { id } = req.params as { id: string };
    const lecture = await prisma.lecture.findUnique({
      where: { id },
      include: {
        liveSession: true,
        course: { include: { subject: true, teachers: { select: { id: true } } } },
        notes: true,
      },
    });
    if (!lecture) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
    await assertCourseAccess(me.id, me.roles, lecture.courseId);
    return lecture;
  });

  app.post('/', async (req) => {
    const me = await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const body = createSchema.parse(req.body);
    await assertCourseAccess(me.id, me.roles, body.courseId);
    return prisma.lecture.create({ data: body });
  });

  app.delete('/:id', async (req) => {
    const me = await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const lec = await prisma.lecture.findUnique({ where: { id } });
    if (!lec) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
    await assertCourseAccess(me.id, me.roles, lec.courseId);
    await prisma.lecture.delete({ where: { id } });
    return { ok: true };
  });

  // Upload a pre-recorded video for a lecture.
  // Streams directly to MinIO; sets recordingUrl on the lecture.
  // Teacher who owns the lecture or admin only.
  app.post('/:id/upload', async (req) => {
    const me = await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { id } = req.params as { id: string };
    const lec = await prisma.lecture.findUnique({
      where: { id },
      include: { course: { include: { teachers: { select: { id: true } } } } },
    });
    if (!lec) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
    const isTeacher = lec.course.teachers.some((t) => t.id === me.id);
    if (!isTeacher && !me.roles.includes(Role.ADMIN) && !me.roles.includes(Role.STAFF)) {
      throw new AppError(403, 'FORBIDDEN', 'Only assigned teacher or admin can upload');
    }

    const data = await req.file();
    if (!data) throw new AppError(400, 'NO_FILE', 'No file attached');

    const ext = data.filename.split('.').pop()?.toLowerCase() ?? 'mp4';
    const allowed = ['mp4', 'webm', 'mkv', 'mov', 'avi'];
    if (!allowed.includes(ext)) {
      throw new AppError(400, 'BAD_FORMAT', `Unsupported format .${ext}. Use: ${allowed.join(', ')}`);
    }

    await ensureBucket();
    const objectName = `lectures/${id}/recording.${ext}`;
    const size = Number(req.headers['content-length'] ?? 0) || undefined;
    await minio.putObject(BUCKET, objectName, data.file, size, { 'Content-Type': data.mimetype });

    const url = publicUrl(objectName);
    await prisma.lecture.update({ where: { id }, data: { recordingUrl: url } });

    return { ok: true, recordingUrl: url };
  });
};
