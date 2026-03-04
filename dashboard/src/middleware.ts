import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════
// Middleware — Protect dashboard routes
// ═══════════════════════════════════════════════════════

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
    // Decode token manually since jsonwebtoken doesn't work in Edge runtime
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token structure');
    
    // Fix base64url padding and decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = atob(base64);
    const payload = JSON.parse(jsonPayload);
    
    // Check if expired
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      throw new Error('Token expired');
    }

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
