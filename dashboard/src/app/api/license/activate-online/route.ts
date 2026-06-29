import { NextRequest } from 'next/server';
import { successResponse, errorResponse, getAuthenticatedSession } from '@/lib/api-middleware';
import { getDrizzleDb, ensureInstallation } from '@/lib/db';
import { installation } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { computeState } from '@/lib/license';

export async function POST(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session) {
      return errorResponse('Unauthorized', 401);
    }
    if (session.role !== 'admin' && session.role !== 'superadmin') {
      return errorResponse('Acceso no autorizado', 403);
    }

    const body = await request.json();
    const { activationKey } = body;

    if (!activationKey) {
      return errorResponse('Falta la clave de activación', 400);
    }

    const installId = await ensureInstallation();
    const db = getDrizzleDb();

    // Query current installation record to check last_validated_at
    const list = await db.select().from(installation).where(eq(installation.id, 1));
    const inst = list[0];

    // Contact the central license server
    const licenseServerUrl = process.env.LICENSE_SERVER_URL || 'http://localhost:4000';
    console.log(`[LICENSE] Requesting activation from license server: ${licenseServerUrl}`);
    
    let res;
    try {
      res = await fetch(`${licenseServerUrl}/api/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activationKey, installId }),
      });
    } catch (fetchErr: any) {
      console.error('[LICENSE] Error connecting to license server:', fetchErr);
      return errorResponse(`No se pudo conectar al servidor de licencias en ${licenseServerUrl}. Por favor, verifique su conexión o intente activación offline.`, 502);
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return errorResponse(errData.error || `El servidor de licencias respondió con código ${res.status}`, 400);
    }

    const { data, signature } = await res.json();
    if (!data || !signature) {
      return errorResponse('El servidor de licencias no devolvió datos y firma válidos.', 400);
    }

    // Validate the received license locally
    const tempInst = {
      id: 1,
      install_id: installId,
      license_data: data,
      license_signature: signature,
      last_validated_at: inst?.last_validated_at || null,
    };

    const licState = await computeState(tempInst);
    if (!licState.valid) {
      let message = 'La licencia recibida no es válida';
      if (licState.reason === 'invalid_signature') message = 'Firma de licencia no válida o alterada.';
      if (licState.reason === 'install_mismatch') message = 'La licencia recibida no coincide con este Install-ID.';
      if (licState.reason === 'expired') message = 'La licencia recibida ya ha expirado.';
      if (licState.reason === 'clock_tamper') message = 'Se detectó manipulación del reloj del sistema.';
      return errorResponse(message, 400);
    }

    // Persist license in database
    const nowIso = new Date().toISOString();
    await db.update(installation)
      .set({
        license_data: data,
        license_signature: signature,
        activated_at: nowIso,
        last_validated_at: nowIso,
      })
      .where(eq(installation.id, 1));

    // Force cache refresh
    const { getLicenseState } = await import('@/lib/license');
    await getLicenseState(true);

    return successResponse({ success: true, payload: licState.payload });
  } catch (error) {
    console.error('License online activation API error:', error);
    return errorResponse('Error interno al activar la licencia en línea');
  }
}
