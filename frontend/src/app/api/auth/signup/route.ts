import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { users, invites } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, role, inviteToken } = await request.json();

    // Validate invite token first (consume BEFORE creating user to prevent race)
    let resolvedRole = role || 'student';
    let consumedToken: string | null = null;
    if (inviteToken) {
      const invite = invites.isValid(inviteToken);
      if (!invite) {
        return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 400 });
      }
      resolvedRole = invite.role;
      consumedToken = inviteToken;
      // Consume immediately so a concurrent request can't use it
      invites.consume(inviteToken);
    }

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = users.getByEmail(email);
    if (existing) {
      // Re-issue the invite token if we already consumed it
      if (consumedToken) invites.create(resolvedRole, 'system');
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = users.create({ name, email, password: hashed, role: resolvedRole });
    const { password: _, ...safeUser } = newUser;

    return NextResponse.json({ success: true, user: safeUser });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
