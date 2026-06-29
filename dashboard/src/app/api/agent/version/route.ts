import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Return mock version metadata for update comparisons
    return NextResponse.json({
      version: '1.0.0',
      url: '/api/agent/download',
      required: false,
    });
  } catch (error) {
    console.error('Error in agent version endpoint:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
