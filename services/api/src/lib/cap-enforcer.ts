// Online-attendance cap. Per-subject AND global caps; stricter wins.
// Called at livestream token mint AND at attendance write for ONLINE mode.

import { CapScope, AttendanceMode } from '@prisma/client';
import { prisma } from '../db.js';

export interface CapDecision {
  allowed: boolean;
  reason?: 'GLOBAL_EXCEEDED' | 'SUBJECT_EXCEEDED';
  globalUsed?: number;
  globalLimit?: number;
  subjectUsed?: number;
  subjectLimit?: number;
}

async function activeCap(scope: CapScope, subjectId: string | null) {
  const now = new Date();
  return prisma.attendanceCap.findFirst({
    where: {
      scope,
      subjectId: scope === CapScope.SUBJECT ? subjectId : null,
      periodStart: { lte: now },
      periodEnd: { gte: now },
    },
    orderBy: { periodStart: 'desc' },
  });
}

async function onlineCount(studentId: string, subjectId: string | null, from: Date, to: Date) {
  return prisma.attendance.count({
    where: {
      studentId,
      mode: AttendanceMode.ONLINE,
      markedAt: { gte: from, lte: to },
      ...(subjectId
        ? { lecture: { course: { subjectId } } }
        : {}),
    },
  });
}

export async function canAttendOnline(studentId: string, subjectId: string): Promise<CapDecision> {
  const [global, subj] = await Promise.all([
    activeCap(CapScope.GLOBAL, null),
    activeCap(CapScope.SUBJECT, subjectId),
  ]);

  let globalUsed: number | undefined;
  if (global) {
    globalUsed = await onlineCount(studentId, null, global.periodStart, global.periodEnd);
    if (globalUsed >= global.maxOnlineLectures) {
      return {
        allowed: false,
        reason: 'GLOBAL_EXCEEDED',
        globalUsed,
        globalLimit: global.maxOnlineLectures,
      };
    }
  }

  let subjectUsed: number | undefined;
  if (subj) {
    subjectUsed = await onlineCount(studentId, subjectId, subj.periodStart, subj.periodEnd);
    if (subjectUsed >= subj.maxOnlineLectures) {
      return {
        allowed: false,
        reason: 'SUBJECT_EXCEEDED',
        subjectUsed,
        subjectLimit: subj.maxOnlineLectures,
      };
    }
  }

  return {
    allowed: true,
    globalUsed,
    globalLimit: global?.maxOnlineLectures,
    subjectUsed,
    subjectLimit: subj?.maxOnlineLectures,
  };
}
