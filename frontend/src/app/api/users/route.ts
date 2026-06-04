import { NextRequest, NextResponse } from 'next/server';
import { users } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

// GET all users — requires any authenticated user
export const GET = logRoute(async function GET(request: NextRequest) {
  if (!requireAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const allUsers = users.getAll().map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      macAddress: u.macAddress ?? null,
    }));
    return NextResponse.json({ users: allUsers });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
);

// POST create user — requires admin
export const POST = logRoute(async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { name, email, password, role } = body;
    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'name, email, password, and role are required' }, { status: 400 });
    }
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    const existing = users.getByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }
    const user = users.create({ name, email, password, role });
    const { password: _, ...safeUser } = user;
    return NextResponse.json({ success: true, user: safeUser }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
);
