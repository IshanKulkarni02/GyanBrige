import { NextRequest, NextResponse } from 'next/server';
import { settings } from '@/lib/db';
import { requireAdmin, requireAuth } from '@/lib/server-auth';

// GET /api/settings — any authenticated user (key is redacted)
export async function GET(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const all = settings.getAll();
  // Never expose the raw API key to non-admins — return a masked version
  const caller = requireAuth(request);
  const isAdmin = caller?.role === 'admin';

  return NextResponse.json({
    useLocalAI:   all.useLocalAI === 'true',
    ollamaModel:  all.ollamaModel  || 'llama3:latest',
    openaiModel:  all.openaiModel  || 'gpt-4o-mini',
    // Only admins see the full key; others see whether one is configured
    openaiKey:    isAdmin ? (all.openaiKey || '') : (all.openaiKey ? '••••••••' : ''),
    hasOpenaiKey: !!all.openaiKey,
  });
}

// PUT /api/settings — admin only
export async function PUT(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();

  if ('useLocalAI'  in body) settings.set('useLocalAI',  String(!!body.useLocalAI));
  if ('ollamaModel' in body) settings.set('ollamaModel', String(body.ollamaModel || 'llama3:latest'));
  if ('openaiModel' in body) settings.set('openaiModel', String(body.openaiModel || 'gpt-4o-mini'));
  // Allow clearing the key by sending empty string
  if ('openaiKey'   in body) settings.set('openaiKey',   String(body.openaiKey  || ''));

  return NextResponse.json({ success: true });
}
