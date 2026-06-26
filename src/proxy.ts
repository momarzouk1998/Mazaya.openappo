import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySession } from '@/lib/db/auth';

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

  let userId: number | null = null;
  if (sessionCookie) {
    const payload = await verifySession(sessionCookie);
    if (payload) userId = payload.userId;
  }

  const { pathname } = request.nextUrl;
  const publicPaths = ['/login', '/register', '/auth'];
  const apiAuthPaths = ['/api/auth'];
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));
  const isApiAuthPath = apiAuthPaths.some((p) => pathname.startsWith(p));

  if (isApiAuthPath) {
    return response;
  }

  if (isPublicPath) {
    if (userId) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  if (!userId) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
