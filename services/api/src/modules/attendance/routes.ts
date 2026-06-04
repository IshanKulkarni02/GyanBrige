// Attendance marking. One canonical write path; many input sources.
// NFC / QR  → verifies signed payload + active lecture in that classroom
// NETWORK   → cross-checks CIDR + BSSID
// MANUAL    → teacher-only override
// LIVE      → recorded by the livestream join itself (NOT this endpoint)

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  AttendanceMode,
  AttendanceSource,
  LectureMode,
  Role,
} from '@prisma/client';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';
import { verifyNfcPayload } from '../../lib/nfc-payload.js';
import { canAttendOnline } from '../../lib/cap-enforcer.js';
import { env } from '../../env.js';
import { isIpInCidr } from '../../lib/cidr.js';

const SOURCES = z.enum(['NFC', 'QR', 'NETWORK', 'MANUAL']);

const markSchema = z.object({
  lectureId: z.string().uuid(),
  source: SOURCES,
  evidence: z.record(z.string(), z.unknown()).default({}),
  studentId: z.string().uuid().optional(), // only honored for MANUAL by teachers
});

const networkSchema = z.object({
  lectureId: z.string().uuid(),
  ip: z.string().optional(),
  ssid: z.string().optional(),
  bssid: z.string().optional(),
});

async function getStudentSubjectIdForLecture(lectureId: string): Promise<string> {
  const lec = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: { course: { select: { subjectId: true } } },
  });
  if (!lec) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
  return lec.course.subjectId;
}

async function getActiveLectureForClassroom(classroomId: string) {
  const now = new Date();
  const windowMin = 90 * 60 * 1000;
  return prisma.lecture.findFirst({
    where: {
      scheduledAt: { gte: new Date(now.getTime() - windowMin), lte: new Date(now.getTime() + windowMin) },
      course: { timetables: { some: { classroomId } } },
    },
    include: { course: { select: { subjectId: true } } },
    orderBy: { scheduledAt: 'desc' },
  });
}

export const registerAttendance: FastifyPluginAsync = async (app) => {
  app.post('/', async (req) => {
    const me = await requireAuth(req);
    const body = markSchema.parse(req.body);

    let studentId = me.id;
    if (body.source === 'MANUAL') {
      if (!me.roles.includes(Role.TEACHER) && !me.roles.includes(Role.ADMIN) && !me.roles.includes(Role.STAFF))
        throw new AppError(403, 'FORBIDDEN', 'Only staff can mark manually');
      if (!body.studentId) throw new AppError(400, 'STUDENT_REQUIRED', 'Manual mark needs studentId');
      studentId = body.studentId;
    }

    const lecture = await prisma.lecture.findUnique({
      where: { id: body.lectureId },
      include: { course: { include: { enrollments: { where: { userId: studentId } } } } },
    });
    if (!lecture) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
    if (lecture.course.enrollments.length === 0 && body.source !== 'MANUAL')
      throw new AppError(403, 'NOT_ENROLLED', 'Student not enrolled');

    if (body.source === 'NFC' || body.source === 'QR') {
      const payload = body.evidence.payload as string | undefined;
      const tagId = body.evidence.tagId as string | undefined;
      if (!payload || !tagId) throw new AppError(400, 'PAYLOAD_REQUIRED', 'NFC payload missing');
      const tag = await prisma.nfcTag.findUnique({ where: { publicId: tagId } });
      if (!tag) throw new AppError(404, 'TAG_UNKNOWN', 'Unknown NFC tag');
      const v = verifyNfcPayload(payload, tag.hmacSecret);
      if (!v.ok) throw new AppError(401, 'TAG_INVALID', `NFC verify: ${v.reason}`);
      // tag must point to the lecture's classroom
      const tt = await prisma.timetable.findFirst({
        where: { courseId: lecture.courseId, classroomId: tag.classroomId },
      });
      if (!tt) throw new AppError(409, 'TAG_WRONG_ROOM', 'Tag is for a different classroom');
    }

    const mode = lecture.mode === LectureMode.ONLINE ? AttendanceMode.ONLINE : AttendanceMode.IN_PERSON;

    if (mode === AttendanceMode.ONLINE) {
      const decision = await canAttendOnline(studentId, lecture.course.subjectId);
      if (!decision.allowed) {
        throw new AppError(403, 'CAP_EXCEEDED', `Online cap exceeded: ${decision.reason}`, decision);
      }
    }

    return prisma.attendance.upsert({
      where: { lectureId_studentId: { lectureId: body.lectureId, studentId } },
      create: {
        lectureId: body.lectureId,
        studentId,
        mode,
        source: body.source as AttendanceSource,
        evidence: body.evidence as never,
        markedById: body.source === 'MANUAL' ? me.id : null,
      },
      update: {
        source: body.source as AttendanceSource,
        evidence: body.evidence as never,
      },
    });
  });

  app.post('/network', async (req) => {
    const me = await requireAuth(req);
    const body = networkSchema.parse(req.body);

    const sourceIp = body.ip ?? req.ip;
    const cidrList = env.CAMPUS_CIDR.split(',').map((s) => s.trim()).filter(Boolean);
    const ok = cidrList.some((cidr) => isIpInCidr(sourceIp, cidr));
    if (!ok) throw new AppError(403, 'OFF_CAMPUS', `IP ${sourceIp} not in campus CIDR`);

    if (body.bssid) {
      const ap = await prisma.campusNetwork.findFirst({
        where: { bssid: { equals: body.bssid, mode: 'insensitive' } },
      });
      if (!ap) throw new AppError(403, 'UNKNOWN_AP', `BSSID ${body.bssid} not a registered AP`);
    }

    const lecture = await prisma.lecture.findUnique({
      where: { id: body.lectureId },
      include: { course: { include: { enrollments: { where: { userId: me.id } } } } },
    });
    if (!lecture) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
    if (lecture.course.enrollments.length === 0)
      throw new AppError(403, 'NOT_ENROLLED', 'Not enrolled');

    return prisma.attendance.upsert({
      where: { lectureId_studentId: { lectureId: body.lectureId, studentId: me.id } },
      create: {
        lectureId: body.lectureId,
        studentId: me.id,
        mode: AttendanceMode.IN_PERSON,
        source: AttendanceSource.NETWORK,
        evidence: { ip: sourceIp, bssid: body.bssid, ssid: body.ssid } as never,
      },
      update: { evidence: { ip: sourceIp, bssid: body.bssid, ssid: body.ssid } as never },
    });
  });

  app.get('/lecture/:lectureId', async (req) => {
    const me = await requireAuth(req);
    const { lectureId } = req.params as { lectureId: string };
    const lec = await prisma.lecture.findUnique({
      where: { id: lectureId },
      select: { course: { select: { teachers: { select: { id: true } } } } },
    });
    if (!lec) throw new AppError(404, 'NOT_FOUND', 'Lecture not found');
    const isStaff =
      me.roles.includes(Role.ADMIN) ||
      me.roles.includes(Role.STAFF) ||
      lec.course.teachers.some((t) => t.id === me.id);
    if (!isStaff) throw new AppError(403, 'FORBIDDEN', 'Only teachers see roster');
    return prisma.attendance.findMany({
      where: { lectureId },
      include: { student: { select: { id: true, name: true, email: true } } },
      orderBy: { markedAt: 'asc' },
    });
  });

  app.get('/me', async (req) => {
    const me = await requireAuth(req);
    return prisma.attendance.findMany({
      where: { studentId: me.id },
      include: { lecture: { include: { course: { include: { subject: true } } } } },
      orderBy: { markedAt: 'desc' },
      take: 200,
    });
  });

  app.get('/me/cap', async (req) => {
    const me = await requireAuth(req);
    const { subjectId } = z.object({ subjectId: z.string().uuid() }).parse(req.query);
    return canAttendOnline(me.id, subjectId);
  });

  app.post('/manual', async (req) => {
    const me = await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const body = z
      .object({ lectureId: z.string().uuid(), studentIds: z.array(z.string().uuid()).min(1) })
      .parse(req.body);
    const created = await prisma.$transaction(
      body.studentIds.map((studentId) =>
        prisma.attendance.upsert({
          where: { lectureId_studentId: { lectureId: body.lectureId, studentId } },
          create: {
            lectureId: body.lectureId,
            studentId,
            mode: AttendanceMode.IN_PERSON,
            source: AttendanceSource.MANUAL,
            evidence: { by: me.id } as never,
            markedById: me.id,
          },
          update: {},
        }),
      ),
    );
    return { count: created.length };
  });
};

export const _internals = { getActiveLectureForClassroom, getStudentSubjectIdForLecture };
