import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './auth-config';

// ═══════════════════════════════════════════════════════
// API Key Middleware — Validates agent requests
// ═══════════════════════════════════════════════════════

import { getDrizzleDb } from './db';
import { api_keys as apiKeysTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function validateApiKey(request: NextRequest, deviceId?: string): Promise<{ valid: boolean; tenantId?: string; deviceId?: string | null }> {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return { valid: false };
  }

  try {
    const db = getDrizzleDb();
    
    // Hash incoming API key using SHA-256
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    const keyRowsList = await db.select()
      .from(apiKeysTable)
      .where(eq(apiKeysTable.key_hash, keyHash));
      
    const keyRow = keyRowsList[0];
    if (!keyRow) {
      return { valid: false };
    }
    
    // Check expiration if set
    if (keyRow.expires_at && new Date() > new Date(keyRow.expires_at)) {
      return { valid: false };
    }

    // Check device binding if key is tied to a specific device
    if (keyRow.device_id && deviceId && keyRow.device_id !== deviceId) {
      console.warn(`[AUTH] Dispositivo no coincide con la API Key bindeada. Esperado: ${keyRow.device_id}, Recibido: ${deviceId}`);
      return { valid: false };
    }
    
    // Update last_used_at safely
    try {
      await db.update(apiKeysTable)
        .set({ last_used_at: new Date().toISOString() })
        .where(eq(apiKeysTable.id, keyRow.id));
    } catch (dbErr) {
      console.error('Error updating API key last_used_at:', dbErr);
    }
    
    return { valid: true, tenantId: keyRow.tenant_id, deviceId: keyRow.device_id ?? null };
  } catch (error) {
    console.error('Error validating agent API key:', error);
    return { valid: false };
  }
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

export interface AuthenticatedSession {
  username: string;
  role: string;
  tenantId: string;
}

export function getAuthenticatedSession(request: NextRequest): AuthenticatedSession | null {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedSession;
    return decoded;
  } catch (error) {
    console.error('JWT session verification failed:', error);
    return null;
  }
}

export function getTenantId(request: NextRequest): string | null {
  const session = getAuthenticatedSession(request);
  return session ? session.tenantId : null;
}
