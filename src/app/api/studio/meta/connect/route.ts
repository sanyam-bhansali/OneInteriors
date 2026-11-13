import { NextResponse } from 'next/server';
import { STATE_COOKIE, startLogin } from '@/modules/studio-intake/meta-account';

/**
 * GET /api/studio/meta/connect — "Connect Facebook" on Settings → Lead
 * sources (owner, 12 Nov 2026; docs/studio-os/LEAD-INTAKE.md). Sends the
 * owner to Facebook's login with a one-time state kept in a cookie; Facebook
 * sends them back to /api/studio/meta/callback.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const back = new URL('/studio/settings/sources', req.url);
  const started = await startLogin();
  if (!started.ok) {
    /* A code, not words: the screen says only what it knows (no text from a link). */
    back.searchParams.set('meta', started.error.startsWith('Your role') ? 'refused' : 'setup');
    return NextResponse.redirect(back, { headers: { 'cache-control': 'no-store' } });
  }
  const res = NextResponse.redirect(started.url, { headers: { 'cache-control': 'no-store' } });
  res.cookies.set(STATE_COOKIE, started.state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/studio/meta', maxAge: 600 });
  return res;
}
