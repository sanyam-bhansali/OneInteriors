import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { STATE_COOKIE, finishLogin } from '@/modules/studio-intake/meta-account';

/**
 * GET /api/studio/meta/callback — Facebook sends the owner back here after
 * "Connect Facebook" (owner, 12 Nov 2026). The state must match the cookie
 * set by /api/studio/meta/connect (so nobody can plant their own Facebook
 * login on a studio); the code is swapped for a token server to server, and
 * the owner lands on the Page picker.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value ?? '';
  const given = u.searchParams.get('state') ?? '';

  const fail = (why: string) => {
    const back = new URL('/studio/settings/sources', req.url);
    back.searchParams.set('meta', why);
    const res = NextResponse.redirect(back, { headers: { 'cache-control': 'no-store' } });
    res.cookies.delete({ name: STATE_COOKIE, path: '/api/studio/meta' });
    return res;
  };

  /* Codes, not words, in the address: the screen says only what it knows. */
  if (!expected || !same(given, expected)) return fail('expired');
  if (u.searchParams.get('error')) return fail('cancelled');
  const code = u.searchParams.get('code');
  if (!code) return fail('expired');

  const done = await finishLogin(code);
  if (!done.ok) {
    console.error('[meta/callback] login not finished', done.error.slice(0, 200));
    return fail(done.error.startsWith('Your role') ? 'refused' : 'failed');
  }
  const res = NextResponse.redirect(new URL('/studio/settings/sources/meta', req.url), { headers: { 'cache-control': 'no-store' } });
  res.cookies.delete({ name: STATE_COOKIE, path: '/api/studio/meta' });
  return res;
}

function same(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
