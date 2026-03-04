import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-middleware';
import { getAllServers, getServerById } from '@/lib/db';

// ═══════════════════════════════════════════════════════
// GET /api/servers — List all servers with metrics
// GET /api/servers?id=srv1 — Get specific server details
// ═══════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('id');

    if (serverId) {
      const server = getServerById(serverId);
      if (!server) {
        return errorResponse('Server not found', 404);
      }
      return successResponse(server);
    }

    const servers = getAllServers();
    return successResponse(servers);
  } catch (error) {
    console.error('Servers API error:', error);
    return errorResponse('Internal server error');
  }
}
