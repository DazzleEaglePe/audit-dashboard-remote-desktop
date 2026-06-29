import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDrizzleDb } from '@/lib/db';
import { users as usersTable } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedSession } from '@/lib/api-middleware';
import { JWT_SECRET } from '@/lib/auth-config';

// GET /api/auth/profile — Get authenticated user details
export async function GET(request: NextRequest) {
  const auth = getAuthenticatedSession(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDrizzleDb();
  const userList = await db.select()
    .from(usersTable)
    .where(and(
      eq(usersTable.username, auth.username),
      eq(usersTable.tenant_id, auth.tenantId)
    ));
  const user = userList[0];

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    username: user.username,
    fullName: user.full_name || 'Administrador',
    avatarUrl: user.avatar_url || '',
  });
}

// PUT /api/auth/profile — Update authenticated user details
export async function PUT(request: NextRequest) {
  const auth = getAuthenticatedSession(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { fullName, newPassword, avatarData } = body;

    const db = getDrizzleDb();
    const userList = await db.select()
      .from(usersTable)
      .where(and(
        eq(usersTable.username, auth.username),
        eq(usersTable.tenant_id, auth.tenantId)
      ));
    const user = userList[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let updatedAvatarUrl = user.avatar_url || '';

    // 1. Process base64 avatar if provided
    if (avatarData) {
      if (!avatarData.startsWith('data:image/png;base64,') && !avatarData.startsWith('data:image/jpeg;base64,')) {
        return NextResponse.json({ error: 'Avatar must be a base64 encoded PNG or JPEG image' }, { status: 400 });
      }

      const match = avatarData.match(/^data:image\/(png|jpeg);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const base64Str = match[2];
        const buffer = Buffer.from(base64Str, 'base64');

        if (buffer.length > 2 * 1024 * 1024) {
          return NextResponse.json({ error: 'Avatar size cannot exceed 2MB' }, { status: 400 });
        }

        const publicDir = path.join(process.cwd(), 'public');
        const avatarsDir = path.join(publicDir, 'avatars');
        if (!fs.existsSync(avatarsDir)) {
          fs.mkdirSync(avatarsDir, { recursive: true });
        }

        const avatarFileName = `${crypto.createHash('md5').update(auth.username).digest('hex')}.${ext}`;
        const avatarPath = path.join(avatarsDir, avatarFileName);
        
        fs.writeFileSync(avatarPath, buffer);
        updatedAvatarUrl = `/avatars/${avatarFileName}?t=${Date.now()}`; // Add timestamp cache buster
      }
    }

    const updates: Partial<typeof usersTable.$inferInsert> = {
      avatar_url: updatedAvatarUrl,
    };

    // 2. Process password change if provided
    if (newPassword && newPassword.trim().length > 0) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
      }
      const hash = bcryptjs.hashSync(newPassword, 10);
      updates.password_hash = hash;
      updates.password_change_required = 0; // Clear the temporary password flag
    }

    // 3. Update full name
    if (fullName !== undefined) {
      updates.full_name = fullName;
    }

    await db.update(usersTable)
      .set(updates)
      .where(and(
        eq(usersTable.username, auth.username),
        eq(usersTable.tenant_id, auth.tenantId)
      ));

    const response = NextResponse.json({
      status: 'ok',
      fullName: updates.full_name || user.full_name,
      avatarUrl: updatedAvatarUrl,
    });

    // Re-issue JWT cookie if password was updated, clearing the mustChangePassword state
    if (newPassword && newPassword.trim().length > 0) {
      const token = jwt.sign(
        { 
          username: user.username, 
          role: user.role, 
          tenantId: user.tenant_id,
          mustChangePassword: false
        }, 
        JWT_SECRET, 
        {
          expiresIn: '24h',
        }
      );

      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
