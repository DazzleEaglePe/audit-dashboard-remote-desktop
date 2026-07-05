import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/api-middleware';
import { getDrizzleDb, listUsersByTenant, createTenantUser } from '@/lib/db';
import { users as usersTable, notifications as notificationsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/users - List users in the tenant
export async function GET(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.role !== 'admin' && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const tenantId = session.tenantId;
    const users = await listUsersByTenant(tenantId);
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/users - Invite/create user in the tenant
export async function POST(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.role !== 'admin' && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const tenantId = session.tenantId;
    const body = await request.json();
    const { username, email, fullName, role } = body;

    // Validate request inputs
    if (!username || !email || !fullName || !role) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
    }

    if (role !== 'admin' && role !== 'viewer') {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Formato de correo electrónico inválido' }, { status: 400 });
    }

    const db = getDrizzleDb();

    // Validate global unique username
    const existingList = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, username.trim().toLowerCase()));

    if (existingList.length > 0) {
      return NextResponse.json({ error: 'El nombre de usuario ya está en uso globalmente' }, { status: 409 });
    }

    // Create user and generate activation token
    const { user, activationToken } = await createTenantUser({
      tenantId,
      username: username.trim().toLowerCase(),
      email: email.trim(),
      fullName: fullName.trim(),
      role,
    });

    // Enqueue activation email
    const origin = request.nextUrl.origin;
    const activationLink = `${origin}/activate?token=${activationToken}`;

    await db.insert(notificationsTable)
      .values({
        tenant_id: tenantId,
        title: 'Invitación a Auditoría ECA',
        message: `Hola ${fullName.trim()},\n\nHas sido invitado a unirte a la plataforma de auditoría RDP de ECA.\n\nPor favor, activa tu cuenta y configura tu contraseña en el siguiente enlace:\n${activationLink}\n\nEste enlace de activación expira en 24 horas.\n\nAtentamente,\nEl Equipo de Auditoría ECA`,
        type: 'system',
        email_sent: 0,
        recipient_email: email.trim(),
      });

    return NextResponse.json({
      status: 'ok',
      userId: user.id,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
