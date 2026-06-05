import { NextRequest, NextResponse } from 'next/server';
import { grievances, users } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const list = user.role === 'admin' ? grievances.getAll() : grievances.getByUser(user.id);

  const enriched = list.map(g => {
    const submitter = users.getById(g.submittedBy);
    return { ...g, submitterName: submitter?.name ?? 'Unknown', submitterRole: submitter?.role ?? '' };
  });

  return NextResponse.json({ grievances: enriched });
}

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, description, category, priority } = body;
  if (!title || !description) {
    return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
  }

  const grievance = grievances.create({
    submittedBy: user.id,
    title,
    description,
    category: category ?? 'general',
    priority: priority ?? 'medium',
  });

  return NextResponse.json({ grievance }, { status: 201 });
}
