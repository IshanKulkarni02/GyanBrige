import { NextRequest, NextResponse } from 'next/server';
import { users, invites } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, role, inviteToken } = await request.json();

    // If an invite token was provided, validate it and use its role
    let resolvedRole = role || 'student';
    if (inviteToken) {
      const invite = invites.isValid(inviteToken);
      if (!invite) {
        return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 400 });
      }
      resolvedRole = invite.role;
    }

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = users.getByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Create user
    const newUser = users.create({
      name,
      email,
      password,
      role: resolvedRole,
    });

    // Consume the invite token so it can't be reused
    if (inviteToken) {
      invites.consume(inviteToken);
    }

    // Return user without password
    const { password: _, ...safeUser } = newUser;

    return NextResponse.json({
      success: true,
      user: safeUser,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
