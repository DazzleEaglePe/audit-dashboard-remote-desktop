import { NextRequest } from 'next/server';
import {
  validateApiKey,
  unauthorizedResponse,
  errorResponse,
  successResponse,
} from '@/lib/api-middleware';
import {
  upsertSessions,
  insertServerMetrics,
  checkServerTimeouts,
  insertAlert,
} from '@/lib/db';
import type { AgentHeartbeatPayload } from '@/types';

// ═══════════════════════════════════════════════════════
// POST /api/agent/heartbeat
// Receives metrics + sessions from PowerShell agents
// ═══════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!validateApiKey(request)) {
      return unauthorizedResponse('Invalid API key');
    }

    const body = (await request.json()) as AgentHeartbeatPayload;

    // Validate required fields
    if (!body.server_id || !body.metrics) {
      return errorResponse('Missing required fields: server_id, metrics', 400);
    }

    // Normalize usernames (Windows is case-insensitive, Linux is not. quser vs $env:USERNAME mismatch fix)
    const normalizedSessions = (body.sessions || []).map(s => ({
      ...s,
      username: s.username ? s.username.toLowerCase() : s.username
    }));

    // Update sessions
    upsertSessions(body.server_id, normalizedSessions);

    // Store metrics
    insertServerMetrics(
      body.server_id,
      body.metrics,
      normalizedSessions.filter((s) => s.state === 'Active').length
    );

    // Check for alerts: high CPU
    if (body.metrics.cpu_percent > 90) {
      insertAlert({
        server_id: body.server_id,
        alert_type: 'high_cpu',
        severity: 'warning',
        message: `CPU al ${body.metrics.cpu_percent.toFixed(1)}% en ${body.hostname || body.server_id}`,
      });
    }

    // Check for stale servers (mark as offline if no heartbeat in 2 min)
    const staleServers = checkServerTimeouts(2);
    for (const serverId of staleServers) {
      insertAlert({
        server_id: serverId,
        alert_type: 'server_down',
        severity: 'critical',
        message: `Servidor ${serverId} sin respuesta (sin heartbeat por >2 min)`,
      });
    }

    // Emit WebSocket event (will be handled by custom server)
    // For now, store in a global variable that the WS server can poll
    if (typeof globalThis !== 'undefined') {
      (globalThis as Record<string, unknown>).__lastHeartbeat = {
        server_id: body.server_id,
        timestamp: new Date().toISOString(),
        metrics: body.metrics,
        sessions: normalizedSessions,
      };
    }

    return successResponse({
      status: 'ok',
      server_id: body.server_id,
      sessions_updated: normalizedSessions.length,
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return errorResponse('Internal server error');
  }
}
