import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════
// POST /api/auth/login — Simple JWT authentication
// Uses credentials.json file to avoid env variable issues with bcrypt $ chars
// ═══════════════════════════════════════════════════════

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me';
const TOKEN_EXPIRY = '24h';

interface UserCredential {
  username: string;
  passwordHash: string;
}

function getAdminUsers(): UserCredential[] {
  const credPath = path.join(process.cwd(), 'data', 'credentials.json');

  if (fs.existsSync(credPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
      return data.users || [];
    } catch (e) {
      console.error('Error reading credentials file:', e);
    }
  }

  return [];
}

// Auto-create credentials file with default admin user
function ensureCredentials(): void {
  const dataDir = path.join(process.cwd(), 'data');
  const credPath = path.join(dataDir, 'credentials.json');

  if (!fs.existsSync(credPath)) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Default admin user: admin / admin123
    const defaultHash = bcryptjs.hashSync('admin123', 10);
    const credentials = {
      users: [{ username: 'admin', passwordHash: defaultHash }],
    };

    fs.writeFileSync(credPath, JSON.stringify(credentials, null, 2));
    console.log('Created default credentials file with admin/admin123');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    ensureCredentials();

    const users = getAdminUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const valid = await bcryptjs.compare(password, user.passwordHash);

    if (!valid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // Generate JWT
    const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY,
    });

    // Set HTTP-only cookie
    const response = NextResponse.json({
      status: 'ok',
      username,
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
