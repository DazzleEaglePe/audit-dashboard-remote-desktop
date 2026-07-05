import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/api-middleware';
import { getDrizzleDb, getUserById } from '@/lib/db';
import { users as usersTable, notifications as notificationsTable } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

// POST /api/superadmin/users/[id]/resend-invite - Regenerate token and resend invitation email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const { id: idStr } = await params;
    const userId = parseInt(idStr, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { tenantId } = body;
    if (!tenantId) {
      return NextResponse.json({ error: 'Falta el parámetro tenantId' }, { status: 400 });
    }

    const targetUser = await getUserById(userId, tenantId);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado en el inquilino' }, { status: 404 });
    }

    if (!targetUser.activation_token) {
      return NextResponse.json({ error: 'El usuario ya ha activado su cuenta' }, { status: 400 });
    }

    const db = getDrizzleDb();

    // Generate new token & update database
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.update(usersTable)
      .set({
        activation_token: token,
        activation_token_expires_at: expiresAt,
      })
      .where(and(
        eq(usersTable.id, userId),
        eq(usersTable.tenant_id, tenantId)
      ));

    // Queue email
    const origin = request.nextUrl.origin;
    const activationLink = `${origin}/activate?token=${token}`;

    await db.insert(notificationsTable)
      .values({
        tenant_id: tenantId,
        title: 'Invitación a Auditoría ECA (Reenvío)',
        message: `Hola ${targetUser.full_name || 'Usuario'},\n\nReenviamos tu invitación para unirte a la plataforma de auditoría RDP de ECA.\n\nPor favor, activa tu cuenta y configura tu contraseña en el siguiente enlace:\n${activationLink}\n\nEste enlace de activación expira en 24 horas.\n\nAtentamente,\nEl Equipo de Auditoría ECA`,
        type: 'system',
        email_sent: 0,
        recipient_email: targetUser.email!.trim(),
      });

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error resending invitation as superadmin:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
