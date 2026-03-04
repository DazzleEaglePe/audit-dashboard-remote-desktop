import { successResponse, errorResponse } from '@/lib/api-middleware';
import { getDashboardStats } from '@/lib/db';

// ═══════════════════════════════════════════════════════
// GET /api/stats — Dashboard summary statistics
// ═══════════════════════════════════════════════════════

export async function GET() {
  try {
    const stats = getDashboardStats();
    return successResponse(stats);
  } catch (error) {
    console.error('Stats API error:', error);
    return errorResponse('Internal server error');
  }
}
