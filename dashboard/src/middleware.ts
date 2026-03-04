import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// ═══════════════════════════════════════════════════════
// Middleware — Protect dashboard routes
// ═══════════════════════════════════════════════════════

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — don't protect
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/agent') ||       // Agent endpoints use API key
    pathname.startsWith('/api/auth') ||         // Auth endpoints
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')                      // Static files
  ) {
    return NextResponse.next();
  }

  // Check auth token for dashboard pages and dashboard API
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    // Redirect to login for pages, 401 for API
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    jwt.verify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    // Token expired or invalid
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Token expired' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));

    response.cookies.delete('auth-token');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
