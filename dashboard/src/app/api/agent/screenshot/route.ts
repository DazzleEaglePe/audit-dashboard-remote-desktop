import { NextRequest } from 'next/server';
import {
  validateApiKey,
  unauthorizedResponse,
  errorResponse,
  successResponse,
} from '@/lib/api-middleware';
import path from 'path';
import fs from 'fs';

// ═══════════════════════════════════════════════════════
// POST /api/agent/screenshot
// Receives screenshot images from PowerShell agents
// ═══════════════════════════════════════════════════════

const SCREENSHOTS_DIR = process.env.SCREENSHOTS_PATH || './public/screenshots';

function ensureScreenshotsDir(): void {
  const dir = path.resolve(SCREENSHOTS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateApiKey(request)) {
      return unauthorizedResponse('Invalid API key');
    }

    const formData = await request.formData();

    const serverId = formData.get('server_id') as string;
    const username = formData.get('username') as string;
    const sessionId = formData.get('session_id') as string;
    const resolution = (formData.get('resolution') as string) || 'thumbnail';
    const image = formData.get('image') as File | null;

    if (!serverId || !username || !image) {
      return errorResponse('Missing required fields: server_id, username, image', 400);
    }

    // Ensure directory exists
    ensureScreenshotsDir();
    const serverDir = path.resolve(SCREENSHOTS_DIR, serverId);
    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir, { recursive: true });
    }

    // Save image to disk (buffer rotativo — solo el último)
    const suffix = resolution === 'full' ? '_full' : '_thumb';
    const filename = `${username}_${sessionId}${suffix}.jpg`;
    const filepath = path.join(serverDir, filename);

    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filepath, buffer);

    const imageUrl = `/screenshots/${serverId}/${filename}?t=${Date.now()}`;

    // Store for WebSocket emission
    if (typeof globalThis !== 'undefined') {
      (globalThis as Record<string, unknown>).__lastScreenshot = {
        server_id: serverId,
        username,
        session_id: parseInt(sessionId) || 0,
        image_url: imageUrl,
        timestamp: new Date().toISOString(),
      };
    }

    return successResponse({
      status: 'ok',
      stored_at: imageUrl,
    });
  } catch (error) {
    console.error('Screenshot error:', error);
    return errorResponse('Internal server error');
  }
}
