import { NextRequest } from 'next/server';
import { successResponse, errorResponse, getTenantId, getAuthenticatedSession } from '@/lib/api-middleware';
import { getAllServers, getServerById, updateServerName } from '@/lib/db';

// ═══════════════════════════════════════════════════════
// GET /api/servers — List all servers with metrics
// GET /api/servers?id=srv1 — Get specific server details
// ═══════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantId(request);
    if (!tenantId) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('id');

    if (serverId) {
      const server = await getServerById(serverId, tenantId);
      if (!server) {
        return errorResponse('Server not found', 404);
      }
      return successResponse(server);
    }

    const servers = await getAllServers(tenantId);
    return successResponse(servers);
  } catch (error) {
    console.error('Servers API error:', error);
    return errorResponse('Internal server error');
  }
}

// ═══════════════════════════════════════════════════════
// PUT /api/servers — Update server friendly name
// ═══════════════════════════════════════════════════════

export async function PUT(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return errorResponse('Acceso no autorizado', 403);
    }

    const body = await request.json();
    const { id, name } = body;

    if (!id || typeof name !== 'string') {
      return errorResponse('Datos de entrada inválidos', 400);
    }

    // Refinement 1: trim name and limit length to 60 characters
    const trimmedName = name.trim().substring(0, 60);

    const success = await updateServerName(id, session.tenantId, trimmedName);
    if (!success) {
      return errorResponse('No se pudo actualizar el nombre del servidor', 500);
    }

    return successResponse({ success: true });
  } catch (error) {
    console.error('Servers API PUT error:', error);
    return errorResponse('Error interno del servidor');
  }
}

