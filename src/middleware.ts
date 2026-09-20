import { NextResponse, type NextRequest } from 'next/server';
import { opsWithoutAuth } from '@/lib/env';
import { audienceFor, route } from '@/lib/host';

/**
 * Two jobs: put each hostname in front of its own product, and keep a
 * cookie-less visitor out of /ops before we render anything.
 *
 * ## The hostname split
 *
 * `studio.oneinteriors.in` serves the practice software, `ops.` the console,
 * and the apex serves the waitlist — which is a separate Vercel project, so in
 * production the apex never reaches this app at all. The decision itself is in
 * `lib/host.ts`, pure and tested, because this file cannot be: middleware runs
 * on the edge and a mistake in it is found by a studio, not by a test run.
 *
 * ## Why the customer app is a redirect and the other two are 404s
 *
 * A visitor who types `/match` while the marketplace is closed is a would-be
 * customer, and the waitlist is the honest answer for them. A visitor who
 * types `/ops` on the studio host is looking for something that should not be
 * there, and a redirect would confirm it exists somewhere.
 *
 * ## The /ops cookie pre-filter, unchanged
 *
 * The real gate is `app/ops/layout.tsx`, which reads the session and the role
 * from Postgres. This only checks that a session cookie exists at all —
 * middleware cannot reach the database, so anything it decided about identity
 * would be trusting an unverified claim. No cookie, no point rendering. **Do
 * not add authorisation logic here.**
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const path = request.nextUrl.pathname;

  // ── 1. Which product answers for this host ──
  const decision = route(host, path);

  if (decision.kind === 'notFound') {
    // `rewrite` to a path with no route, rather than NextResponse.error():
    // the visitor gets the app's own 404 page rather than a bare edge error,
    // and the URL they typed stays in the bar so they can see what they got
    // wrong.
    return NextResponse.rewrite(new URL('/404', request.url));
  }

  if (decision.kind === 'redirect') {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (decision.kind === 'rewrite') {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    return NextResponse.rewrite(url);
  }

  // ── 2. The /ops cookie pre-filter ──
  // Applies on whichever host is serving ops: the ops subdomain, where the
  // path has just been rewritten from `/`, or any host at all when the split
  // is not configured.
  const servingOps =
    path === '/ops' || path.startsWith('/ops/') || audienceFor(host) === 'ops';

  if (!servingOps) return NextResponse.next();

  // The development bypass has to be honoured here too, or the cookie check
  // below redirects to /sign-in before the layout ever gets to allow it.
  // Read `opsWithoutAuth` in src/lib/env.ts before relying on this: it refuses
  // to work once the roster is declared real, and in production outright.
  if (opsWithoutAuth()) return NextResponse.next();

  if (!request.cookies.get('oi_session')?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Everything except the things that must never be rewritten.
 *
 * This used to match `/ops` alone. It has to be broad now, because the host
 * split decides what `/` means — and a matcher that skipped `/` would leave
 * the studio subdomain serving the customer landing page, which is the one
 * page this whole change exists to hide.
 *
 * Excluded: Next's own build output, and anything with a file extension.
 * `/api` and `/auth` are matched but pass straight through as
 * `isAlwaysAllowed` — they are listed there rather than excluded here so that
 * the allow-list lives in one readable place instead of half in a regex.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)'],
};
