import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/api-middleware';
import { 
  getDrizzleDb, 
  getUserById, 
  updateTenantUser, 
  deleteTenantUser, 
  countAdminsInTenant,
  tenantNeedsOnboarding
} from '@/lib/db';
import { users as usersTable } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth-config';

// Helper to check if a user is the last admin
async function isLastAdmin(tenantId: string, userId: number): Promise<boolean> {
  const adminCount = await countAdminsInTenant(tenantId);
  if (adminCount > 1) return false;

  const db = getDrizzleDb();
  const userList = await db.select()
    .from(usersTable)
    .where(and(
      eq(usersTable.id, userId),
      eq(usersTable.tenant_id, tenantId)
    ));
  const user = userList[0];
  return user ? user.role === 'admin' : false;
}

// PUT /api/users/[id] - Update user details (scoped to tenant)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.role !== 'admin' && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { id: idStr } = await params;
    const userId = parseInt(idStr, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
    }

    const tenantId = session.tenantId;
    const body = await request.json();
    const { fullName, role, username } = body;

    // Guard: Prevent privilege escalation
    if (role !== undefined && role !== 'admin' && role !== 'viewer') {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const db = getDrizzleDb();

    // Verify user exists in tenant
    const targetUser = await getUserById(userId, tenantId);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado en tu empresa' }, { status: 404 });
    }

    // Guard: Prevent demoting the last admin to viewer
    if (role === 'viewer' && targetUser.role === 'admin') {
      const lastAdminCheck = await isLastAdmin(tenantId, userId);
      if (lastAdminCheck) {
        return NextResponse.json({ error: 'No puedes degradar al único administrador de la empresa.' }, { status: 409 });
      }
    }

    // Validate global uniqueness of username if it is being changed
    let normalizedUsername = targetUser.username;
    if (username && username.trim().toLowerCase() !== targetUser.username) {
      normalizedUsername = username.trim().toLowerCase();
      const existingList = await db.select()
        .from(usersTable)
        .where(and(
          eq(usersTable.username, normalizedUsername),
          ne(usersTable.id, userId)
        ));
      if (existingList.length > 0) {
        return NextResponse.json({ error: 'El nombre de usuario ya está en uso globalmente' }, { status: 409 });
      }
    }

    // Update user in DB
    await updateTenantUser(userId, tenantId, {
      fullName: fullName ? fullName.trim() : undefined,
      role: role || undefined,
      username: normalizedUsername,
    });

    const response = NextResponse.json({ status: 'ok' });

    // If the logged in user is changing their own username/role, re-emit JWT token
    if (session.username === targetUser.username) {
      const mustChangePassword = targetUser.password_change_required === 1;
      const mustCompleteOnboarding = (role || targetUser.role) === 'viewer' 
        ? false 
        : await tenantNeedsOnboarding(tenantId);

      const newToken = jwt.sign(
        {
          username: normalizedUsername,
          role: role || targetUser.role,
          tenantId: tenantId,
          mustChangePassword,
          mustCompleteOnboarding,
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      response.cookies.set('auth-token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Remove user (hard delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.role !== 'admin' && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { id: idStr } = await params;
    const userId = parseInt(idStr, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
    }

    const tenantId = session.tenantId;
    const targetUser = await getUserById(userId, tenantId);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado en tu empresa' }, { status: 404 });
    }

    // Guard: Prevent self-deletion
    if (session.username === targetUser.username) {
      return NextResponse.json({ error: 'No puedes eliminar tu propio usuario.' }, { status: 409 });
    }

    // Guard: Prevent deleting the last admin
    if (targetUser.role === 'admin') {
      const lastAdminCheck = await isLastAdmin(tenantId, userId);
      if (lastAdminCheck) {
        return NextResponse.json({ error: 'No puedes eliminar al único administrador de la empresa.' }, { status: 409 });
      }
    }

    await deleteTenantUser(userId, tenantId);
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
