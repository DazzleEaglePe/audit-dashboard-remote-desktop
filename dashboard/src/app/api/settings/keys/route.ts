import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDrizzleDb } from '@/lib/db';
import { api_keys as apiKeysTable } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedSession } from '@/lib/api-middleware';

// GET /api/settings/keys — List all API keys for the current tenant
export async function GET(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const db = getDrizzleDb();
    const keys = await db.select({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      expires_at: apiKeysTable.expires_at,
      created_at: apiKeysTable.created_at,
      last_used_at: apiKeysTable.last_used_at,
    })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.tenant_id, session.tenantId));

    return NextResponse.json(keys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/settings/keys — Create a new API Key for the current tenant
export async function POST(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { name, expires_at } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre de la clave es obligatorio' }, { status: 400 });
    }

    // Generate secure random API key (32 chars hex + prefix = 40 chars total)
    const rawKey = 'eca_key_' + crypto.randomBytes(16).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const db = getDrizzleDb();

    // Insert key
    const result = await db.insert(apiKeysTable)
      .values({
        tenant_id: session.tenantId,
        name: name.trim(),
        key_hash: keyHash,
        expires_at: expires_at || null,
      })
      .returning({ id: apiKeysTable.id });

    const lastId = result[0].id;

    return NextResponse.json({
      status: 'ok',
      rawKey, // Returned only once here
      key: {
        id: lastId,
        name: name.trim(),
        expires_at: expires_at || null,
        created_at: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/settings/keys — Revoke (delete) an API Key
export async function DELETE(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json({ error: 'El ID de la clave es obligatorio' }, { status: 400 });
    }

    const db = getDrizzleDb();

    // Verify key exists and belongs to this tenant
    const idNum = parseInt(keyId, 10);
    const keyRowList = await db.select()
      .from(apiKeysTable)
      .where(and(
        eq(apiKeysTable.id, idNum),
        eq(apiKeysTable.tenant_id, session.tenantId)
      ));
    const keyRow = keyRowList[0];

    if (!keyRow) {
      return NextResponse.json({ error: 'Clave de API no encontrada' }, { status: 404 });
    }

    // Delete key
    await db.delete(apiKeysTable)
      .where(eq(apiKeysTable.id, idNum));

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
