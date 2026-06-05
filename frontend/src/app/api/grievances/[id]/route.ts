import { NextRequest, NextResponse } from 'next/server';
import { grievances } from '@/lib/db';
import { requireAdmin } from '@/lib/server-auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { status, adminNote } = body;

  const updated = grievances.update(id, { status, adminNote });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ grievance: updated });
}
