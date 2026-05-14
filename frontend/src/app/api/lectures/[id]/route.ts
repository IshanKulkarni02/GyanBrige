import { NextRequest, NextResponse } from 'next/server';
import { lectures } from '@/lib/db';

// GET single lecture
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lecture = lectures.getById(id);

    if (!lecture) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
    }

    return NextResponse.json({ lecture });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch lecture' }, { status: 500 });
  }
}

// PUT update lecture
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = lectures.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, lecture: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update lecture' }, { status: 500 });
  }
}

// DELETE lecture
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = lectures.delete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete lecture' }, { status: 500 });
  }
}
