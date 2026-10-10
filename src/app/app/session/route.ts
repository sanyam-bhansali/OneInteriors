import { NextResponse } from 'next/server';
import { adoptBearerAsCookie } from '@/modules/auth/session';

/**
 * GET /app/session?next=/app/coins — the phone app's way into its web pages.
 * The WebView's first request carries the app's bearer header; the same
 * session becomes the WebView's cookie, then it goes on to `next`. Only /app
 * pages are allowed as `next`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('next') ?? '/app';
  const next = raw.startsWith('/app') && !raw.startsWith('//') ? raw : '/app';
  await adoptBearerAsCookie(req.headers.get('authorization'));
  return NextResponse.redirect(new URL(next, url.origin));
}
