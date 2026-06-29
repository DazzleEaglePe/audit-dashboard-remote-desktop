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
    const { data, signature } = body;

    if (!data || !signature) {
      return errorResponse('Faltan los datos o la firma de la licencia', 400);
    }

    const installId = await ensureInstallation();
    const db = getDrizzleDb();

    // Query current installation record to check last_validated_at
    const list = await db.select().from(installation).where(eq(installation.id, 1));
    const inst = list[0];

    const tempInst = {
      id: 1,
      install_id: installId,
      license_data: data,
      license_signature: signature,
      last_validated_at: inst?.last_validated_at || null,
    };

    const licState = await computeState(tempInst);
    if (!licState.valid) {
      let message = 'La licencia no es válida';
      if (licState.reason === 'invalid_signature') message = 'Firma de licencia no válida o alterada.';
      if (licState.reason === 'install_mismatch') message = 'Esta licencia pertenece a otra instalación (Install-ID diferente).';
      if (licState.reason === 'expired') message = 'La licencia ha expirado.';
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
    console.error('License activation API error:', error);
    return errorResponse('Error interno al activar la licencia');
  }
}
