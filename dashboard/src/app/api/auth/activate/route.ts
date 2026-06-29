import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDrizzleDb, tenantNeedsOnboarding } from '@/lib/db';
import { users as usersTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { JWT_SECRET } from '@/lib/auth-config';
import { rateLimit } from '@/lib/rate-limiter';

// GET /api/auth/activate?token=ABC123XYZ - Check if activation token is valid
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    if (!rateLimit(`activate_get_${ip}`, 5, 60000)) {
      return NextResponse.json({ error: 'Too many attempts, please try again later.' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const db = getDrizzleDb();
    const userList = await db.select()
      .from(usersTable)
      .where(eq(usersTable.activation_token, token));
    const user = userList[0];

    if (!user) {
      return NextResponse.json({ error: 'Token de activación inválido' }, { status: 400 });
    }

    // Check expiration
    const expiry = user.activation_token_expires_at;
    if (expiry && new Date() > new Date(expiry)) {
      return NextResponse.json({ error: 'El token de activación ha expirado' }, { status: 400 });
    }

    return NextResponse.json({
      status: 'ok',
      username: user.username,
      email: user.email,
    });
  } catch (error) {
    console.error('Verify activation token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/auth/activate - Activate account and set initial password
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    if (!rateLimit(`activate_post_${ip}`, 5, 60000)) {
      return NextResponse.json({ error: 'Too many attempts, please try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const db = getDrizzleDb();
    const userList = await db.select()
      .from(usersTable)
      .where(eq(usersTable.activation_token, token));
    const user = userList[0];

    if (!user) {
      return NextResponse.json({ error: 'Token inválido o cuenta ya activada' }, { status: 400 });
    }

    // Check expiration
    const expiry = user.activation_token_expires_at;
    if (expiry && new Date() > new Date(expiry)) {
      return NextResponse.json({ error: 'El token de activación ha expirado' }, { status: 400 });
    }

    // Hash new password
    const passwordHash = bcryptjs.hashSync(password, 10);

    // Update user
    await db.update(usersTable)
      .set({
        password_hash: passwordHash,
        password_change_required: 0,
        activation_token: null,
        activation_token_expires_at: null,
      })
      .where(eq(usersTable.id, user.id));

    // Check if onboarding is required
    const needsOnboarding = await tenantNeedsOnboarding(user.tenant_id);

    // Log the user in by generating a JWT
    const jwtToken = jwt.sign(
      { 
        username: user.username, 
        role: user.role, 
        tenantId: user.tenant_id,
        mustChangePassword: false,
        mustCompleteOnboarding: needsOnboarding
      }, 
      JWT_SECRET, 
      {
        expiresIn: '24h',
      }
    );

    const response = NextResponse.json({
      status: 'ok',
      username: user.username,
      tenantId: user.tenant_id,
      mustCompleteOnboarding: needsOnboarding,
    });

    // Set cookie
    response.cookies.set('auth-token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Account activation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
