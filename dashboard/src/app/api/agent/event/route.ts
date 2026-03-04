import { NextRequest } from 'next/server';
import {
  validateApiKey,
  unauthorizedResponse,
  errorResponse,
  successResponse,
} from '@/lib/api-middleware';
import { insertSessionLog, insertAlert } from '@/lib/db';
import type { AgentEventPayload } from '@/types';

// ═══════════════════════════════════════════════════════
// POST /api/agent/event
// Receives connection/disconnection events from agents
// ═══════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    if (!validateApiKey(request)) {
      return unauthorizedResponse('Invalid API key');
    }

    const body = (await request.json()) as AgentEventPayload;

    // Validate required fields
    if (!body.server_id || !body.event_type || !body.username || !body.timestamp) {
      return errorResponse(
        'Missing required fields: server_id, event_type, username, timestamp',
        400
      );
    }

    // Store event log
    insertSessionLog({
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
      insertAlert({
        server_id: body.server_id,
        alert_type: 'login_failed',
        severity: 'warning',
        message: `Intento de conexión fallido: ${body.username} desde ${body.source_ip || 'IP desconocida'} en ${body.server_id}`,
      });
    }

    // Store for WebSocket emission
    if (typeof globalThis !== 'undefined') {
      (globalThis as Record<string, unknown>).__lastEvent = {
        server_id: body.server_id,
        username: body.username,
        event_type: body.event_type,
        session_id: body.session_id,
        timestamp: body.timestamp,
      };
    }

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
