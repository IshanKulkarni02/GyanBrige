import { NextRequest, NextResponse } from 'next/server';
import { invites } from '@/lib/db';
import { requireAdmin } from '@/lib/server-auth';

// GET all invites — admin only
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    return NextResponse.json({ invites: invites.getAll() });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
  }
}

// POST create invite link — admin only
export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { role } = await request.json();
    if (!role || !['student', 'teacher', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    const invite = invites.create(role, admin.id);
    return NextResponse.json({ success: true, invite });
  } catch {
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }
}
