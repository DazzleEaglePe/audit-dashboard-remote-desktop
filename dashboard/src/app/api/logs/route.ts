import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-middleware';
import { getSessionLogs } from '@/lib/db';

// ═══════════════════════════════════════════════════════
// GET /api/logs — Audit logs with filters
// ═══════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      username: searchParams.get('username') || undefined,
      server_id: searchParams.get('server_id') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const { logs, total } = getSessionLogs(filters);

    return successResponse({
      logs,
      total,
      limit: filters.limit,
      offset: filters.offset,
      has_more: filters.offset + filters.limit < total,
    });
  } catch (error) {
    console.error('Logs API error:', error);
    return errorResponse('Internal server error');
  }
}
