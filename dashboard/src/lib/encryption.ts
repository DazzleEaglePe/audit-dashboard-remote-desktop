import crypto from 'crypto';
import { JWT_SECRET } from './auth-config';

const ALGORITHM = 'aes-256-gcm';
// Use ENCRYPTION_KEY if available, else derive from JWT_SECRET
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest()
  : crypto.createHash('sha256').update(JWT_SECRET).digest();


export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encryptedText
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(text: string): string {
  try {
    const parts = text.split(':');
    if (parts.length !== 3) return text; // Maybe it's not encrypted (legacy plain text)
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed, returning original text (might be legacy plain text):', error);
    return text;
  }
}
