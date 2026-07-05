import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/api-middleware';
import { 
  getDrizzleDb, 
  getUserById, 
  updateTenantUser, 
  deleteTenantUser, 
  countAdminsInTenant 
} from '@/lib/db';
import { users as usersTable } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';

// Helper to check if a user is the last admin of a tenant
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

// PUT /api/superadmin/users/[id] - Update user details
export async function PUT(
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
    const { tenantId, fullName, role, username } = body;

    // Guard: Prevent privilege escalation
    if (role !== undefined && role !== 'admin' && role !== 'viewer') {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Falta el parámetro tenantId' }, { status: 400 });
    }

    const db = getDrizzleDb();

    // Verify user exists in tenant
    const targetUser = await getUserById(userId, tenantId);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado en el inquilino' }, { status: 404 });
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

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error updating tenant user as superadmin:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/superadmin/users/[id] - Remove user (hard delete)
export async function DELETE(
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

    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Falta el parámetro tenantId' }, { status: 400 });
    }

    const targetUser = await getUserById(userId, tenantId);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado en el inquilino' }, { status: 404 });
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
    console.error('Error deleting tenant user as superadmin:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
