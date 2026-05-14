import { NextRequest, NextResponse } from 'next/server';
import { invites } from '@/lib/db';

// GET validate token (used by signup page)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const invite = invites.isValid(token);
    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 });
    }
    return NextResponse.json({ valid: true, role: invite.role, expiresAt: invite.expiresAt });
  } catch {
    return NextResponse.json({ error: 'Failed to validate invite' }, { status: 500 });
  }
}

// DELETE revoke invite
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const deleted = invites.delete(token);
    if (!deleted) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to revoke invite' }, { status: 500 });
  }
}
