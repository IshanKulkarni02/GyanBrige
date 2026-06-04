import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import Database from 'better-sqlite3';
import path from 'path';
import { logRoute } from '@/lib/logger';

export const DELETE = logRoute(async function DELETE(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = new Database(path.join(process.cwd(), 'data', 'gyanbrige.db'));
  db.pragma('foreign_keys = OFF');

  db.exec(`
    DELETE FROM attendance;
    DELETE FROM enrollments;
    DELETE FROM lectures;
    DELETE FROM courses;
    DELETE FROM invites;
    DELETE FROM users WHERE role != 'admin';
  `);

  db.pragma('foreign_keys = ON');
  db.close();

  return NextResponse.json({ success: true });
}
);
