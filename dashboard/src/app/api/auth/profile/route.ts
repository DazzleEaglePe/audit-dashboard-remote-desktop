import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me';

interface UserCredential {
  username: string;
  passwordHash: string;
  fullName?: string;
  avatarUrl?: string;
}

function getCredentialsPath() {
  return path.join(process.cwd(), 'data', 'credentials.json');
}

function readCredentials(): { users: UserCredential[] } {
  const credPath = getCredentialsPath();
  if (fs.existsSync(credPath)) {
    try {
      return JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    } catch (e) {
      console.error('Error reading credentials file:', e);
    }
  }
  return { users: [] };
}

function writeCredentials(data: { users: UserCredential[] }) {
  const credPath = getCredentialsPath();
  const dir = path.dirname(credPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(credPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Helper to authenticate request using JWT cookie
function getAuthenticatedUser(request: NextRequest): { username: string } | null {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { username: string };
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

// GET /api/auth/profile — Get authenticated user details
export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credentials = readCredentials();
  const currentUser = credentials.users.find(u => u.username === user.username);

  if (!currentUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    username: currentUser.username,
    fullName: currentUser.fullName || 'Administrador',
    avatarUrl: currentUser.avatarUrl || '',
  });
}

// PUT /api/auth/profile — Update authenticated user details
export async function PUT(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { fullName, newPassword, avatarData } = body;

    const credentials = readCredentials();
    const userIndex = credentials.users.findIndex(u => u.username === user.username);

    if (userIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentUser = credentials.users[userIndex];
    let updatedAvatarUrl = currentUser.avatarUrl || '';

    // 1. Process base64 avatar if provided
    if (avatarData && avatarData.startsWith('data:image/')) {
      const match = avatarData.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const base64Str = match[2];
        const buffer = Buffer.from(base64Str, 'base64');

        const publicDir = path.join(process.cwd(), 'public');
        const avatarsDir = path.join(publicDir, 'avatars');
        if (!fs.existsSync(avatarsDir)) {
          fs.mkdirSync(avatarsDir, { recursive: true });
        }

        const avatarFileName = `${user.username}-avatar.${ext}`;
        const avatarPath = path.join(avatarsDir, avatarFileName);
        
        fs.writeFileSync(avatarPath, buffer);
        updatedAvatarUrl = `/avatars/${avatarFileName}?t=${Date.now()}`; // Add timestamp cache buster
      }
    }

    // 2. Process password change if provided
    if (newPassword && newPassword.trim().length > 0) {
      const defaultHash = bcryptjs.hashSync(newPassword, 10);
      currentUser.passwordHash = defaultHash;
    }

    // 3. Update full name
    if (fullName !== undefined) {
      currentUser.fullName = fullName;
    }

    currentUser.avatarUrl = updatedAvatarUrl;

    // Save changes
    writeCredentials(credentials);

    return NextResponse.json({
      status: 'ok',
      fullName: currentUser.fullName,
      avatarUrl: currentUser.avatarUrl,
    });
  } catch (error) {
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
