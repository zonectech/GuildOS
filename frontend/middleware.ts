import { NextRequest, NextResponse } from 'next/server';

/**
 * Best-effort decode of the JWT role claim for route gating (UX + defense in depth).
 * No signature verification here — the backend re-authenticates every API call;
 * a forged cookie only changes which shell page renders, never what data is served.
 * Older tokens without a role claim return null and are allowed through (client-side
 * checks still apply) so live sessions don't break on deploy.
 */
function readRoleClaim(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as { role?: string };
    return typeof claims.role === 'string' ? claims.role : null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Recruiter signup is public.
  if (pathname.startsWith('/recruiter/signup')) {
    return NextResponse.next();
  }

  // The API's own cookie is only visible here when both run on one site (local dev).
  // In production the API is on another domain, so the app mirrors a marker cookie
  // (guildos_session=<role>) after sign-in; see auth-api.ts.
  const accessToken = request.cookies.get('guildos_access_token')?.value;
  const sessionMarker = request.cookies.get('guildos_session')?.value;

  if (!accessToken && !sessionMarker) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = accessToken ? readRoleClaim(accessToken) : decodeURIComponent(sessionMarker ?? '') || null;
  if (role) {
    if (pathname.startsWith('/dashboard/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/home', request.url));
    }
    if (pathname.startsWith('/recruiter') && role !== 'RECRUITER' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/home', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/home/:path*', '/dashboard/:path*', '/profile-setup/:path*', '/recruiter/:path*', '/recruiter'],
};
