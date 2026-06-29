import { NextRequest } from 'next/server';
import { successResponse, errorResponse, getTenantId } from '@/lib/api-middleware';
import { getAllActiveSessions } from '@/lib/db';

// ═══════════════════════════════════════════════════════
// GET /api/sessions — List all active sessions
// ═══════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantId(request);
    if (!tenantId) {
      return errorResponse('Unauthorized', 401);
    }
    const sessions = await getAllActiveSessions(tenantId);
    return successResponse(sessions);
  } catch (error) {
    console.error('Sessions API error:', error);
    return errorResponse('Internal server error');
  }
}
