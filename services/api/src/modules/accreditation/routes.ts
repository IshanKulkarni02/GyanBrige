// NAAC/NBA-shaped accreditation export. Maps assessments → Course Outcomes →
// Program Outcomes. Returns CSV (+ JSON for PDF generation client-side).
// Rubric criteria store CO/PO codes as criterion ids ("CO1", "PO3" etc.).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../../db.js';
import { requireRole } from '../../lib/role-guard.js';

function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]!);
  const head = keys.join(',');
  const body = rows
    .map((r) =>
      keys
        .map((k) => {
          const v = String(r[k] ?? '');
          return v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(','),
    )
    .join('\n');
  return `${head}\n${body}`;
}

export const registerAccreditation: FastifyPluginAsync = async (app) => {
  app.get('/course/:courseId/outcomes', async (req, reply) => {
    await requireRole(req, Role.TEACHER, Role.ADMIN, Role.STAFF);
    const { courseId } = req.params as { courseId: string };
    const { format = 'json' } = z
      .object({ format: z.enum(['json', 'csv']).default('json') })
      .parse(req.query);

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    const submissions = await prisma.submission.findMany({
      where: { assignment: { courseId }, status: { in: ['GRADED'] } },
      include: { assignment: { select: { rubric: true, maxScore: true } } },
    });

    interface Cell {
      studentId: string;
      studentName: string;
      coScores: Record<string, { sum: number; weight: number; count: number }>;
    }
    const cells = new Map<string, Cell>();
    for (const e of enrollments) {
      cells.set(e.userId, { studentId: e.userId, studentName: e.user.name, coScores: {} });
    }

    for (const s of submissions) {
      const rubric = s.assignment.rubric as { criteria?: { id: string; weight: number }[] } | null;
      const cell = cells.get(s.studentId);
      if (!cell || !rubric?.criteria) continue;
      for (const cr of rubric.criteria) {
        const code = cr.id; // expect "CO1", "CO2" etc.
        const slot = cell.coScores[code] ?? { sum: 0, weight: 0, count: 0 };
        const ratio = (s.score ?? 0) / Math.max(s.assignment.maxScore, 1);
        slot.sum += ratio * cr.weight;
        slot.weight += cr.weight;
        slot.count += 1;
        cell.coScores[code] = slot;
      }
    }

    const allCodes = new Set<string>();
    for (const c of cells.values()) Object.keys(c.coScores).forEach((k) => allCodes.add(k));
    const codes = [...allCodes].sort();

    const rows = [...cells.values()].map((c) => {
      const row: Record<string, string | number> = {
        studentId: c.studentId,
        studentName: c.studentName,
      };
      for (const code of codes) {
        const slot = c.coScores[code];
        row[code] = slot ? (slot.sum / Math.max(slot.weight, 1)).toFixed(3) : '';
      }
      return row;
    });

    if (format === 'csv') {
      reply.type('text/csv');
      reply.header('Content-Disposition', `attachment; filename="course-${courseId}-outcomes.csv"`);
      return toCsv(rows);
    }
    return { codes, rows };
  });
};
