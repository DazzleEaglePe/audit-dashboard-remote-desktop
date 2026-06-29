import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDrizzleDb, tenantNeedsOnboarding } from '@/lib/db';
import { users as usersTable, tenants as tenantsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { JWT_SECRET } from '@/lib/auth-config';
import { rateLimit } from '@/lib/rate-limiter';

const TOKEN_EXPIRY = '24h';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    
    // Check rate limit: 5 requests per minute per IP
    if (!rateLimit(`login_${ip}`, 5, 60000)) {
      return NextResponse.json({ error: 'Too many login attempts, please try again later.' }, { status: 429 });
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const db = getDrizzleDb();

    // Query user by username
    const userList = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, username));
    const user = userList[0];

    if (!user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const valid = await bcryptjs.compare(password, user.password_hash);

    if (!valid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // Verify tenant status
    const tenantList = await db.select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, user.tenant_id));
    const tenant = tenantList[0];

    if (tenant && tenant.status !== 'active') {
      return NextResponse.json({
        error: 'La cuenta de tu empresa está inactiva o suspendida. Comunícate con soporte.'
      }, { status: 403 });
    }

    // Check if onboarding is required
    const needsOnboarding = await tenantNeedsOnboarding(user.tenant_id);

    // Generate JWT with tenant_id, role, password_change_required, and mustCompleteOnboarding flags
    const token = jwt.sign(
      { 
        username: user.username, 
        role: user.role, 
        tenantId: user.tenant_id,
        mustChangePassword: user.password_change_required === 1,
        mustCompleteOnboarding: needsOnboarding
      }, 
      JWT_SECRET, 
      {
        expiresIn: TOKEN_EXPIRY,
      }
    );

    const response = NextResponse.json({
      status: 'ok',
      username: user.username,
      mustChangePassword: user.password_change_required === 1,
      mustCompleteOnboarding: needsOnboarding,
    });

    // Set HTTP-only cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
