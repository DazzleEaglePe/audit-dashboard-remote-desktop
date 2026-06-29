import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDrizzleDb } from '@/lib/db';
import { 
  api_keys as apiKeysTable, 
  admin_audit_logs as adminAuditLogsTable, 
  servers as serversTable 
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { validateApiKey } from '@/lib/api-middleware';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta la cabecera x-api-key' }, { status: 400 });
    }

    // Validate incoming key
    const auth = await validateApiKey(request);
    if (!auth.valid || !auth.tenantId) {
      return NextResponse.json({ error: 'Clave de API no válida o revocada' }, { status: 401 });
    }

    const db = getDrizzleDb();
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // 1. Delete the API key to free the licensing/device slots
    await db.delete(apiKeysTable).where(eq(apiKeysTable.key_hash, keyHash));

    // 2. Clean up corresponding server row (optional but recommended)
    if (auth.deviceId) {
      await db.delete(serversTable).where(
        and(
          eq(serversTable.id, auth.deviceId),
          eq(serversTable.tenant_id, auth.tenantId)
        )
      );
    }

    // 3. Write audit log entry
    try {
      const xff = request.headers.get('x-forwarded-for') || '';
      const clientIp = xff.split(',')[0].trim() || 'unknown';
      
      await db.insert(adminAuditLogsTable).values({
        tenant_id: auth.tenantId,
        username: 'SYSTEM (Desregistro)',
        action: 'agent_deregister',
        ip_address: clientIp,
        details: JSON.stringify({ device_id: auth.deviceId || null }),
      });
    } catch (auditErr) {
      console.error('Failed to log audit entry for agent deregistration:', auditErr);
    }

    console.log(`[DEREGISTER] API Key desregistrada con éxito. Hash: ${keyHash}`);

    return NextResponse.json({
      status: 'ok',
      message: 'Dispositivo desregistrado y clave de API eliminada.',
    });
  } catch (error) {
    console.error('Error in agent deregister endpoint:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
