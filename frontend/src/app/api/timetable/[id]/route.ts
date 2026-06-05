import { NextRequest, NextResponse } from 'next/server';
import { timetable } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(request);
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const deleted = timetable.delete(id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
