import { NextRequest, NextResponse } from 'next/server';
import { settings } from '@/lib/db';
import { requireAdmin, requireAuth } from '@/lib/server-auth';
import { logRoute } from '@/lib/logger';

// GET /api/settings — any authenticated user (key is redacted)
export const GET = logRoute(async function GET(request: NextRequest) {
  if (!requireAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const all = settings.getAll();
  // Never expose the raw API key to non-admins — return a masked version
  const caller = requireAuth(request);
  const isAdmin = caller?.role === 'admin';

  return NextResponse.json({
    // AI
    useLocalAI:   all.useLocalAI === 'true',
    ollamaModel:  all.ollamaModel  || 'llama3:latest',
    openaiModel:  all.openaiModel  || 'gpt-4o-mini',
    openaiKey:    isAdmin ? (all.openaiKey || '') : (all.openaiKey ? '••••••••' : ''),
    hasOpenaiKey: !!all.openaiKey,
    // Site
    siteName:              all.siteName              || 'GyanBrige',
    allowSignup:           all.allowSignup           !== 'false',
    requireApproval:       all.requireApproval       === 'true',
    maxUploadSizeGb:       all.maxUploadSizeGb       || '25',
    transcriptionLanguage: all.transcriptionLanguage || 'auto',
    // LiveKit
    livekitUrl:       isAdmin ? (all.livekit_url       || '') : (all.livekit_url       ? '••••' : ''),
    livekitApiKey:    isAdmin ? (all.livekit_api_key   || '') : (all.livekit_api_key   ? '••••' : ''),
    livekitApiSecret: isAdmin ? (all.livekit_api_secret|| '') : (all.livekit_api_secret? '••••' : ''),
    hasLivekit: !!(all.livekit_url && all.livekit_api_key && all.livekit_api_secret),
  });
}
);

// PUT /api/settings — admin only
export const PUT = logRoute(async function PUT(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();

  // AI settings
  if ('useLocalAI'  in body) settings.set('useLocalAI',  String(!!body.useLocalAI));
  if ('ollamaModel' in body) settings.set('ollamaModel', String(body.ollamaModel || 'llama3:latest'));
  if ('openaiModel' in body) settings.set('openaiModel', String(body.openaiModel || 'gpt-4o-mini'));
  if ('openaiKey'   in body) settings.set('openaiKey',   String(body.openaiKey  || ''));

  // Site settings
  if ('siteName'             in body) settings.set('siteName',             String(body.siteName             || 'GyanBrige'));
  if ('allowSignup'          in body) settings.set('allowSignup',          String(!!body.allowSignup));
  if ('requireApproval'      in body) settings.set('requireApproval',      String(!!body.requireApproval));
  if ('maxUploadSizeGb'      in body) settings.set('maxUploadSizeGb',      String(body.maxUploadSizeGb      || '25'));
  if ('transcriptionLanguage' in body) settings.set('transcriptionLanguage', String(body.transcriptionLanguage || 'auto'));

  // LiveKit settings
  if ('livekitUrl'       in body) settings.set('livekit_url',        String(body.livekitUrl       || ''));
  if ('livekitApiKey'    in body) settings.set('livekit_api_key',    String(body.livekitApiKey    || ''));
  if ('livekitApiSecret' in body) settings.set('livekit_api_secret', String(body.livekitApiSecret || ''));

  return NextResponse.json({ success: true });
}
);
