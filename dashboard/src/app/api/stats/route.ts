import { NextRequest } from 'next/server';
import { successResponse, errorResponse, getTenantId } from '@/lib/api-middleware';
import { getDashboardStats } from '@/lib/db';

// ═══════════════════════════════════════════════════════
// GET /api/stats — Dashboard summary statistics
// ═══════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantId(request);
    if (!tenantId) {
      return errorResponse('Unauthorized', 401);
    }
    const stats = await getDashboardStats(tenantId);
    return successResponse(stats);
  } catch (error) {
    console.error('Stats API error:', error);
    return errorResponse('Internal server error');
  }
}
