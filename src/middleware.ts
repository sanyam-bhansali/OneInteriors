import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cheap pre-filter for /ops.
 *
 * The real gate is `src/app/ops/layout.tsx`, which reads the session and the
 * user's current role from Postgres. This only checks that a session cookie
 * exists at all — middleware runs on the edge runtime and cannot reach the
 * database, so anything it decided about *identity* would have to trust an
 * unverified claim.
 *
 * So: no cookie, no point rendering. A cookie present means the layout does the
 * actual work. Do not add authorisation logic here.
 */
export function middleware(request: NextRequest) {
  const hasSessionCookie = Boolean(request.cookies.get('oi_session')?.value);

  if (!hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/ops', '/ops/:path*'],
};
