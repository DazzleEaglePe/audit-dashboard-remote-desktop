import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limiter';
import { validateAndConsumeEnrollToken } from '@/lib/db';

// POST /api/agent/enroll - Enrolamiento de un nuevo agente
export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting by Client IP. Generous limit to support bulk deployment
    // behind corporate NAT (many machines share one public IP). The real abuse
    // backstops are the token's max_uses + the license limit.
    const xff = request.headers.get('x-forwarded-for') || '';
    const clientIp = xff.split(',')[0].trim() || 'unknown';
    if (!rateLimit(`enroll:${clientIp}`, 60, 60000)) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes de enrolamiento. Intente de nuevo en un minuto.' },
        { status: 429 }
      );
    }

    // 2. Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Cuerpo de la petición JSON no válido.' },
        { status: 400 }
      );
    }

    const { enroll_token, server_guid, hostname } = body;

    if (!enroll_token || !server_guid || !hostname) {
      return NextResponse.json(
        { error: 'Los campos enroll_token, server_guid y hostname son obligatorios.' },
        { status: 400 }
      );
    }

    if (server_guid.trim().length < 10 || hostname.trim().length === 0) {
      return NextResponse.json(
        { error: 'Parámetros del agente no válidos.' },
        { status: 400 }
      );
    }

    // 3. Consume token and register API key
    const result = await validateAndConsumeEnrollToken(
      enroll_token.trim(),
      server_guid.trim(),
      hostname.trim(),
      clientIp
    );

    if (!result.success) {
      console.warn(`[ENROLL FAIL] GUID: ${server_guid}, Host: ${hostname}, Motivo: ${result.error}`);
      return NextResponse.json(
        { error: 'No se pudo completar el enrolamiento debido a un error de validación o límites.' },
        { status: 403 }
      );
    }

    // 4. Respond with the generated API key (returned once here)
    return NextResponse.json({
      status: 'ok',
      api_key: result.apiKey,
    });
  } catch (err) {
    console.error('Error in agent enroll endpoint:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
