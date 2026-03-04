import { NextRequest } from 'next/server';
import path from 'path';
import fs from 'fs';

const SCREENSHOTS_DIR = process.env.SCREENSHOTS_PATH || './public/screenshots';

// ═══════════════════════════════════════════════════════
// GET /api/screenshots/[serverId]/[filename]
// Serves screenshot images securely from the server disk
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string; filename: string }> }
) {
  try {
    const { serverId, filename } = await params;
    
    // Basic validation to prevent directory traversal
    if (!serverId || !filename || filename.includes('..') || serverId.includes('..')) {
      return new Response('Invalid request', { status: 400 });
    }

    const filepath = path.join(path.resolve(SCREENSHOTS_DIR), serverId, filename);

    if (!fs.existsSync(filepath)) {
      return new Response('Not found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filepath);
    
    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error serving screenshot:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
