// Bulk SIS import: parses a CSV of users + enrollments and upserts in batches.
// CSV columns: email,name,role,deptCode,subjectCode?,semester?,year?
// Idempotent: re-running with same emails updates existing rows.

import { parse } from 'csv-parse/sync';
import argon2 from 'argon2';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

interface Row {
  email: string;
  name: string;
  role: keyof typeof Role;
  deptCode: string;
  subjectCode?: string;
  semester?: string;
  year?: string;
}

export interface BulkImportResult {
  users: number;
  enrollments: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export async function runBulkImport(csv: string, tempPasswordHint = 'changeMe123!'): Promise<BulkImportResult> {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Row[];
  const hashed = await argon2.hash(tempPasswordHint);
  const out: BulkImportResult = { users: 0, enrollments: 0, skipped: 0, errors: [] };

  const deptByCode = new Map<string, string>();
  const subjectByCode = new Map<string, string>();
  const deps = await prisma.department.findMany({ select: { id: true, name: true } });
  for (const d of deps) deptByCode.set(d.name.toUpperCase().replace(/\s+/g, ''), d.id);
  const subs = await prisma.subject.findMany({ select: { id: true, code: true } });
  for (const s of subs) subjectByCode.set(s.code.toUpperCase(), s.id);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    try {
      if (!r.email || !r.name || !r.role || !r.deptCode) {
        out.skipped++;
        continue;
      }
      const deptId = deptByCode.get(r.deptCode.toUpperCase().replace(/\s+/g, ''));
      if (!deptId) throw new Error(`Unknown department: ${r.deptCode}`);

      const user = await prisma.user.upsert({
        where: { email: r.email },
        update: { name: r.name },
        create: { email: r.email, name: r.name, hashedPassword: hashed },
      });
      await prisma.userRole.upsert({
        where: {
          userId_role_scopeId: { userId: user.id, role: r.role as Role, scopeId: deptId },
        },
        update: {},
        create: { userId: user.id, role: r.role as Role, scopeId: deptId },
      });
      out.users++;

      if (r.subjectCode && r.semester && r.year && r.role === 'STUDENT') {
        const subjectId = subjectByCode.get(r.subjectCode.toUpperCase());
        if (!subjectId) throw new Error(`Unknown subject: ${r.subjectCode}`);
        const course = await prisma.course.upsert({
          where: {
            subjectId_semester_year: {
              subjectId,
              semester: Number(r.semester),
              year: Number(r.year),
            },
          },
          update: {},
          create: { subjectId, semester: Number(r.semester), year: Number(r.year) },
        });
        await prisma.enrollment.upsert({
          where: { userId_courseId: { userId: user.id, courseId: course.id } },
          create: { userId: user.id, courseId: course.id },
          update: {},
        });
        out.enrollments++;
      }
    } catch (err) {
      out.errors.push({ row: i + 2, message: (err as Error).message });
    }
  }

  return out;
}
