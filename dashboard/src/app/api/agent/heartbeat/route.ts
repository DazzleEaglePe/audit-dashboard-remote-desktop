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
  insertAlert,
  verifyAndRegisterServer,
} from '@/lib/db';
import type { AgentHeartbeatPayload } from '@/types';
import { notifyServerUpdate } from '@/lib/socket';

// ═══════════════════════════════════════════════════════
// POST /api/agent/heartbeat
// Receives metrics + sessions from agents
// ═══════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentHeartbeatPayload;

    // Validate required fields
    if (!body.server_id || !body.metrics) {
      return errorResponse('Missing required fields: server_id, metrics', 400);
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
      body.hostname,
      body.metrics.ram_total_mb ? Math.round(body.metrics.ram_total_mb / 1024) : undefined,
      undefined
    );

    if (!verified) {
      return errorResponse('Forbidden: Server belongs to another tenant', 403);
    }

    // PowerShell's ConvertTo-Json serializes single-element arrays as plain objects {},
    // not arrays [{}]. We must normalize to always be an array before calling .map()
    const rawSessions = body.sessions
      ? (Array.isArray(body.sessions) ? body.sessions : [body.sessions])
      : [];

    // Normalize usernames (Windows is case-insensitive, Linux is not)
    const normalizedSessions = rawSessions.map(s => ({
      ...s,
      username: s.username ? s.username.toLowerCase() : s.username
    }));

    // Update sessions
    await upsertSessions(body.server_id, normalizedSessions);

    // Store metrics
    await insertServerMetrics(
      body.server_id,
      body.metrics,
      normalizedSessions.filter((s) => s.state === 'Active').length
    );

    // Check for alerts: high CPU
    if (body.metrics.cpu_percent > 90) {
      await insertAlert({
        server_id: body.server_id,
        alert_type: 'high_cpu',
        severity: 'warning',
        message: `CPU al ${body.metrics.cpu_percent.toFixed(1)}% en ${body.hostname || body.server_id}`,
      });
    }

    // Note: Stale servers check and data retention cleanups have been moved to server.ts background workers

    // Emit WebSocket event
    notifyServerUpdate(tenantId, body.server_id, {
      metrics: body.metrics,
      sessions: normalizedSessions,
    });

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

