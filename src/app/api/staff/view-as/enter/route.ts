import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/modules/auth/session';
import { enterViewAs } from '@/modules/studio/view-as';
import { VIEW_AS_HINT_COOKIE, hintSecret, signHint } from '@/modules/studio/view-as-rules';

/**
 * GET /api/staff/view-as/enter?ticket=… — developer access (owner, 22 Oct
 * 2026; docs/studio-os/VIEW-AS.md). The second half of "Open as…" on the ops
 * page: redeems the one-time, two-minute ticket on the studio host, sets the
 * admin's session cookie here when there was none (a view-only session that
 * ends with the view) and the middleware's read-only hint, and opens the
 * studio. A GET, so the middleware's write block never stands in its way;
 * the ticket is the only thing it trusts, and it works once.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };

export async function GET(req: Request) {
  const ticket = new URL(req.url).searchParams.get('ticket') ?? '';
  const jar = await cookies();
  const entered = await enterViewAs(ticket, jar.get(SESSION_COOKIE)?.value ?? null);
  if (!entered.ok) return new Response(entered.error, { status: 403, headers: NO_STORE });

  const secure = process.env.NODE_ENV === 'production';
  const res = NextResponse.redirect(new URL('/studio', req.url), 303);
  res.headers.set('cache-control', 'no-store');
  res.headers.set('referrer-policy', 'no-referrer');
  if (entered.newToken) {
    res.cookies.set(SESSION_COOKIE, entered.newToken, { httpOnly: true, sameSite: 'lax', secure, path: '/', expires: entered.until });
  }
  res.cookies.set(VIEW_AS_HINT_COOKIE, await signHint(hintSecret(process.env), entered.sessionToken, entered.until), {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: entered.until,
  });
  return res;
}
