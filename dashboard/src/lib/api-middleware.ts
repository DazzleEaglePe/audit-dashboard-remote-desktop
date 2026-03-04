import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════
// API Key Middleware — Validates agent requests
// ═══════════════════════════════════════════════════════

export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.AGENT_API_KEY;

  if (!expectedKey) {
    console.error('AGENT_API_KEY not configured in environment');
    return false;
  }

  return apiKey === expectedKey;
}

export function unauthorizedResponse(message: string = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function successResponse(data: unknown, status: number = 200) {
  return NextResponse.json(data, { status });
}
