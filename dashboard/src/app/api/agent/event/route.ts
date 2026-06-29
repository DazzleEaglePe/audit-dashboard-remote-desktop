import { NextRequest } from 'next/server';
import {
  validateApiKey,
  unauthorizedResponse,
  errorResponse,
  successResponse,
} from '@/lib/api-middleware';
import { insertSessionLog, insertAlert, verifyAndRegisterServer } from '@/lib/db';
import type { AgentEventPayload } from '@/types';
import { notifySessionUpdate } from '@/lib/socket';

// ═══════════════════════════════════════════════════════
// POST /api/agent/event
// Receives connection/disconnection events from agents
// ═══════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentEventPayload;

    // Validate required fields
    if (!body.server_id || !body.event_type || !body.username || !body.timestamp) {
      return errorResponse(
        'Missing required fields: server_id, event_type, username, timestamp',
        400
      );
    }

    // Validate API key dynamically and resolve tenantId, enforcing device binding
    const auth = await validateApiKey(request, body.server_id);
    if (!auth.valid || !auth.tenantId) {
      return unauthorizedResponse('Invalid API key');
    }
    const tenantId = auth.tenantId;

    if (auth.deviceId && auth.deviceId !== body.server_id) {
      return unauthorizedResponse('La API key no corresponde a este equipo');
    }

    // Verify server ownership / auto-register under this tenant
    const verified = await verifyAndRegisterServer(
      body.server_id,
      tenantId,
      undefined,
      undefined,
      undefined
    );

    if (!verified) {
      return errorResponse('Forbidden: Server belongs to another tenant', 403);
    }

    // Store event log
    await insertSessionLog({
      server_id: body.server_id,
      username: body.username,
      event_type: body.event_type as 'connect' | 'disconnect' | 'idle' | 'active',
      session_id: body.session_id || null,
      source_ip: body.source_ip || null,
      timestamp: body.timestamp,
      details: null,
    });

    // Generate alert for login failures
    if (body.event_type === 'login_failed') {
      await insertAlert({
        server_id: body.server_id,
        alert_type: 'login_failed',
        severity: 'warning',
        message: `Intento de conexión fallido: ${body.username} desde ${body.source_ip || 'IP desconocida'} en ${body.server_id}`,
      });
    }

    // Emit WebSocket event
    notifySessionUpdate(tenantId, body.server_id, {
      username: body.username,
      event_type: body.event_type,
      session_id: body.session_id,
      timestamp: body.timestamp,
    });

    return successResponse({
      status: 'ok',
      event_type: body.event_type,
      username: body.username,
    });
  } catch (error) {
    console.error('Event error:', error);
    return errorResponse('Internal server error');
  }
}

