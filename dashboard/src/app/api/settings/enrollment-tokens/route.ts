import { NextRequest, NextResponse } from 'next/server';
import { getDrizzleDb, createEnrollmentToken, revokeEnrollmentToken } from '@/lib/db';
import { enrollment_tokens as enrollmentTokensTable } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getAuthenticatedSession } from '@/lib/api-middleware';

// GET /api/settings/enrollment-tokens - List all tokens for the tenant
export async function GET(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const db = getDrizzleDb();
    const tokens = await db.select({
      id: enrollmentTokensTable.id,
      name: enrollmentTokensTable.name,
      max_uses: enrollmentTokensTable.max_uses,
      used_count: enrollmentTokensTable.used_count,
      expires_at: enrollmentTokensTable.expires_at,
      revoked: enrollmentTokensTable.revoked,
      created_by: enrollmentTokensTable.created_by,
      created_at: enrollmentTokensTable.created_at,
    })
    .from(enrollmentTokensTable)
    .where(eq(enrollmentTokensTable.tenant_id, session.tenantId))
    .orderBy(desc(enrollmentTokensTable.created_at));

    return NextResponse.json(tokens);
  } catch (error) {
    console.error('Error listing enrollment tokens:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/settings/enrollment-tokens - Create a new token
export async function POST(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Cuerpo de la petición JSON no válido' }, { status: 400 });
    }

    const { name, max_uses, expires_at } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre del token es obligatorio' }, { status: 400 });
    }

    let parsedMaxUses: number | null = null;
    if (max_uses !== undefined && max_uses !== null && max_uses !== '') {
      parsedMaxUses = parseInt(max_uses, 10);
      if (isNaN(parsedMaxUses) || parsedMaxUses <= 0) {
        return NextResponse.json({ error: 'El límite de usos debe ser un número entero mayor a 0' }, { status: 400 });
      }
    }

    if (expires_at) {
      const parsedDate = Date.parse(expires_at);
      if (isNaN(parsedDate)) {
        return NextResponse.json({ error: 'La fecha de expiración no es una fecha válida' }, { status: 400 });
      }
    }

    const result = await createEnrollmentToken(
      session.tenantId,
      name.trim(),
      session.username || 'Admin',
      parsedMaxUses,
      expires_at || null
    );

    if (!result.success || !result.rawToken) {
      return NextResponse.json({ error: result.error || 'No se pudo crear el token' }, { status: 500 });
    }

    return NextResponse.json({
      status: 'ok',
      rawToken: result.rawToken, // Returned once
      token: {
        name: name.trim(),
        max_uses: parsedMaxUses,
        expires_at: expires_at || null,
        created_at: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Error creating enrollment token:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/settings/enrollment-tokens?id= - Revoke enrollment token
export async function DELETE(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tokenIdStr = searchParams.get('id');

    if (!tokenIdStr) {
      return NextResponse.json({ error: 'El ID del token es obligatorio' }, { status: 400 });
    }

    const tokenId = parseInt(tokenIdStr, 10);
    if (isNaN(tokenId)) {
      return NextResponse.json({ error: 'ID del token no válido' }, { status: 400 });
    }

    const success = await revokeEnrollmentToken(tokenId, session.tenantId);
    if (!success) {
      return NextResponse.json({ error: 'No se pudo revocar el token' }, { status: 500 });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error revoking enrollment token:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
