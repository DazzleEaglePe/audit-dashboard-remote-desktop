import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDrizzleDb } from '@/lib/db';
import { tenant_settings, admin_audit_logs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { JWT_SECRET } from '@/lib/auth-config';

// POST /api/auth/onboarding - Save alert emails and complete onboarding
export async function POST(request: NextRequest) {
  try {
    // 1. Get and verify JWT from cookies
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error('Invalid token on onboarding POST:', err);
      return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
    }

    const { tenantId, username, role, mustChangePassword } = payload;
    if (!tenantId || !username) {
      return NextResponse.json({ error: 'Token mal formado' }, { status: 401 });
    }

    // 2. Read and validate body
    const body = await request.json();
    const { alertEmails } = body;

    if (!alertEmails || typeof alertEmails !== 'string') {
      return NextResponse.json({ error: 'Por favor, ingresa al menos un correo.' }, { status: 400 });
    }

    const emails = alertEmails.split(',').map(e => e.trim());
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emails.length === 0 || emails.some(email => !emailRegex.test(email))) {
      return NextResponse.json({ error: 'Uno o más correos ingresados tienen un formato inválido' }, { status: 400 });
    }

    const db = getDrizzleDb();

    // 3. Upsert into tenant_settings table
    await db.insert(tenant_settings)
      .values({
        tenant_id: tenantId,
        alert_emails: alertEmails,
      })
      .onConflictDoUpdate({
        target: tenant_settings.tenant_id,
        set: {
          alert_emails: alertEmails,
        },
      });

    // 4. Log the audit entry
    try {
      const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
      await db.insert(admin_audit_logs).values({
        tenant_id: tenantId,
        username: username,
        action: 'complete_onboarding',
        ip_address: ip,
        details: JSON.stringify({ alert_emails: alertEmails }),
      });
    } catch (auditErr) {
      console.error('Error logging onboarding to audit logs:', auditErr);
    }

    // 5. Re-emit a fresh JWT with mustCompleteOnboarding = false
    const newJwtToken = jwt.sign(
      { 
        username, 
        role, 
        tenantId,
        mustChangePassword: !!mustChangePassword,
        mustCompleteOnboarding: false
      }, 
      JWT_SECRET, 
      {
        expiresIn: '24h',
      }
    );

    const response = NextResponse.json({
      status: 'ok',
      username,
      tenantId,
    });

    // Re-set cookie
    response.cookies.set('auth-token', newJwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Onboarding API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
