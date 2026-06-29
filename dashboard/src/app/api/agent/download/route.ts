import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAuthenticatedSession } from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
  try {
    // 1. Validate that the requester has an active administrator session
    const session = getAuthenticatedSession(request);
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // 2. Resolve path from the non-public private folder
    const msiPath = path.join(process.cwd(), 'private', 'EcaAgent.msi');
    if (!fs.existsSync(msiPath)) {
      return NextResponse.json(
        { error: 'El instalador MSI no está disponible en este servidor todavía.' },
        { status: 404 }
      );
    }

    // 3. Serve the file via a Web ReadableStream to prevent memory bloating
    const fileStream = fs.createReadStream(msiPath);
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      }
    });

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="EcaAgent.msi"',
      },
    });
  } catch (error) {
    console.error('Error serving agent download:', error);
    return NextResponse.json({ error: 'Error interno al descargar el instalador' }, { status: 500 });
  }
}
