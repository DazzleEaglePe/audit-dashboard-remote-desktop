import crypto from 'crypto';
import { getDrizzleDb } from './db';
import { installation } from '../db/schema';
import { eq } from 'drizzle-orm';

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAksjdxJOXWRFcPsTsh0yqoSHBfxY84CXXgKn+yEcSR18=
-----END PUBLIC KEY-----`;

export interface LicensePayload {
  licenseId: string;
  customerName: string;
  installId: string;
  maxServers: number;
  plan: string;
  features: string[];
  issuedAt: string;
  expiresAt: string;
}

export type LicenseState =
  | { valid: true; payload: LicensePayload; maxServers: number }
  | { valid: false; reason: 'missing' | 'invalid_signature' | 'install_mismatch' | 'expired' | 'clock_tamper' };

let cached: { state: LicenseState; at: number } | null = null;

export async function getLicenseState(force = false): Promise<LicenseState> {
  if (!force && cached && Date.now() - cached.at < 60_000) return cached.state;

  const db = getDrizzleDb();
  let inst;
  try {
    const list = await db.select().from(installation).where(eq(installation.id, 1));
    inst = list[0];
  } catch (err) {
    console.error('[LICENSE] Error querying installation row:', err);
    return { valid: false, reason: 'missing' };
  }

  const state = await computeState(inst);
  cached = { state, at: Date.now() };
  return state;
}

export async function computeState(inst: any): Promise<LicenseState> {
  if (!inst || !inst.license_data || !inst.license_signature) {
    return { valid: false, reason: 'missing' };
  }

  try {
    // 1. Verify signature
    const dataBuffer = Buffer.from(inst.license_data, 'base64');
    const signatureBuffer = Buffer.from(inst.license_signature, 'base64');
    const verified = crypto.verify(null, dataBuffer, PUBLIC_KEY, signatureBuffer);
    if (!verified) {
      return { valid: false, reason: 'invalid_signature' };
    }

    const payload = JSON.parse(dataBuffer.toString('utf8')) as LicensePayload;

    // 2. Verify install_id matches
    if (payload.installId !== inst.install_id) {
      return { valid: false, reason: 'install_mismatch' };
    }

    const nowIso = new Date().toISOString();

    // 3. Verify clock anti-rollback
    if (inst.last_validated_at) {
      const nowTime = new Date(nowIso).getTime();
      const lastValTime = new Date(inst.last_validated_at).getTime();
      // Throw clock_tamper if system clock is set back by more than 5 minutes
      if (nowTime < lastValTime - 5 * 60 * 1000) {
        return { valid: false, reason: 'clock_tamper' };
      }
    }

    // 4. Verify expiration
    const expiryTime = new Date(payload.expiresAt).getTime();
    const nowTime = new Date(nowIso).getTime();
    if (nowTime > expiryTime) {
      return { valid: false, reason: 'expired' };
    }

    // 5. Update last_validated_at in database
    try {
      const db = getDrizzleDb();
      await db.update(installation)
        .set({ last_validated_at: nowIso })
        .where(eq(installation.id, 1));
    } catch (writeErr) {
      console.warn('[LICENSE] Could not update last_validated_at:', writeErr);
    }

    return { valid: true, payload, maxServers: payload.maxServers };
  } catch (err) {
    console.error('[LICENSE] Error computing license state:', err);
    return { valid: false, reason: 'invalid_signature' };
  }
}
