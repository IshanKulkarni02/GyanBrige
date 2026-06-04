import { NextRequest, NextResponse } from 'next/server';
import { users } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

// GET single user — requires auth
export const GET = logRoute(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const user = users.getById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt, macAddress: user.macAddress ?? null },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
);

// PUT update user — requires admin OR the user themselves
export const PUT = logRoute(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = requireAuth(request);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  if (caller.role !== 'admin' && caller.id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await request.json();
    // Non-admins cannot change their own role
    if (caller.role !== 'admin') delete body.role;

    if (body.macAddress !== undefined && body.macAddress !== null && body.macAddress !== '') {
      const macRegex = /^([0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2}$/;
      if (!macRegex.test(body.macAddress.trim())) {
        return NextResponse.json({ error: 'Invalid MAC address format (expected a0:b1:c2:d3:e4:f5)' }, { status: 400 });
      }
      body.macAddress = body.macAddress.trim().toLowerCase().replace(/-/g, ':');
    }

    const updated = users.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, createdAt: updated.createdAt, macAddress: updated.macAddress ?? null },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
);

// DELETE user — requires admin
export const DELETE = logRoute(async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const deleted = users.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
);
