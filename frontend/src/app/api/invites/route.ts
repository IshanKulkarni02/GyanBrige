import { NextRequest, NextResponse } from 'next/server';
import { invites } from '@/lib/db';

// GET all invites (admin only — enforced client-side)
export async function GET() {
  try {
    return NextResponse.json({ invites: invites.getAll() });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
  }
}

// POST create invite link
export async function POST(request: NextRequest) {
  try {
    const { role, createdBy } = await request.json();
    if (!role || !createdBy) {
      return NextResponse.json({ error: 'role and createdBy are required' }, { status: 400 });
    }
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    const invite = invites.create(role, createdBy);
    return NextResponse.json({ success: true, invite });
  } catch {
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }
}
