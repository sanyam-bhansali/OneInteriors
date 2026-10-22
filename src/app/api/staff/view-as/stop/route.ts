import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { SESSION_COOKIE } from '@/modules/auth/session';
import { sameOrigin } from '@/modules/project/site-http';
import { opsUrl, stopViewAs } from '@/modules/studio/view-as';
import { VIEW_AS_HINT_COOKIE } from '@/modules/studio/view-as-rules';

/**
 * POST /api/staff/view-as/stop — developer access (owner, 22 Oct 2026;
 * docs/studio-os/VIEW-AS.md): the banner's Stop. The one write a viewing
 * session may make, and so its own route: the middleware allows it by path
 * (view-as-rules.ts `VIEW_AS_STOP_PATH`). Clears the view (a view-only
 * session is revoked and its cookie dropped), writes `staff.view_as.stop`,
 * drops the read-only hint, and goes back to the studio's ops page.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response('Not from here.', { status: 403, headers: { 'cache-control': 'no-store' } });
  const jar = await cookies();
  const stopped = await stopViewAs(jar.get(SESSION_COOKIE)?.value ?? null);
  const target = stopped.slug ? opsUrl(await headers(), stopped.slug) : stopped.revoked ? '/studio/sign-in' : '/studio';
  const to = new URL(target, req.url);
  /* Back to another host (the ops host, when the hosts are split) by a page
     rather than a redirect: the CSP's `form-action 'self'` also covers where
     a form's redirect lands, so a cross-origin 303 here would be blocked. */
  const res =
    to.origin === new URL(req.url).origin
      ? NextResponse.redirect(to, 303)
      : new NextResponse(leavingPage(to.toString()), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  res.headers.set('cache-control', 'no-store');
  res.cookies.delete(VIEW_AS_HINT_COOKIE);
  if (stopped.revoked) res.cookies.delete(SESSION_COOKIE);
  return res;
}

const escapeHtml = (v: string): string => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A one-line page that goes back to the ops page by itself (a meta refresh is a navigation, not a form). */
function leavingPage(url: string): string {
  const u = escapeHtml(url);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${u}"><title>Stopped viewing</title></head><body style="font:15px system-ui,sans-serif;padding:24px">Stopped viewing. <a href="${u}">Back to the ops page</a>.</body></html>`;
}
