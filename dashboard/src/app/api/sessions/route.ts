import { successResponse, errorResponse } from '@/lib/api-middleware';
import { getAllActiveSessions } from '@/lib/db';

// ═══════════════════════════════════════════════════════
// GET /api/sessions — List all active sessions
// ═══════════════════════════════════════════════════════

export async function GET() {
  try {
    const sessions = getAllActiveSessions();
    return successResponse(sessions);
  } catch (error) {
    console.error('Sessions API error:', error);
    return errorResponse('Internal server error');
  }
}
