import { NextRequest } from 'next/server';
import { successResponse, errorResponse, getAuthenticatedSession } from '@/lib/api-middleware';
import { getLicenseState } from '@/lib/license';
import { ensureInstallation } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session) {
      return errorResponse('Unauthorized', 401);
    }
    if (session.role !== 'admin' && session.role !== 'superadmin') {
      return errorResponse('Acceso no autorizado', 403);
    }

    const installId = await ensureInstallation();
    const licState = await getLicenseState();

    if (licState.valid) {
      return successResponse({
        valid: true,
        installId,
        customerName: licState.payload.customerName,
        maxServers: licState.maxServers,
        plan: licState.payload.plan,
        expiresAt: licState.payload.expiresAt,
        issuedAt: licState.payload.issuedAt,
        features: licState.payload.features
      });
    } else {
      return successResponse({
        valid: false,
        reason: licState.reason,
        installId
      });
    }
  } catch (error) {
    console.error('License status API error:', error);
    return errorResponse('Internal server error');
  }
}
