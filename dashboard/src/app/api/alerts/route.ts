import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-middleware';
import { getAlerts, markAlertRead } from '@/lib/db';

// ═══════════════════════════════════════════════════════
// GET /api/alerts — List alerts
// PUT /api/alerts — Mark alert as read
// ═══════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    const alerts = getAlerts(unreadOnly);
    return successResponse(alerts);
  } catch (error) {
    console.error('Alerts API error:', error);
    return errorResponse('Internal server error');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return errorResponse('Missing alert id', 400);
    }

    markAlertRead(id);
    return successResponse({ status: 'ok', id });
  } catch (error) {
    console.error('Alert update error:', error);
    return errorResponse('Internal server error');
  }
}
