import { NextResponse, type NextRequest } from 'next/server';

/**
 * Stopgap gate on /ops.
 *
 * The ops console has no authentication yet — that is OI-3 (WhatsApp OTP) plus
 * a role check. Until then this blocks the route anywhere that isn't local
 * development, so an internal verification queue cannot be reached from a
 * public deploy by anyone who guesses the URL.
 *
 * This is a lock on the door, not a security model. Delete it in the same PR
 * that adds real auth — and do not relax it before then, because "just for the
 * demo" is how an unauthenticated admin surface reaches production.
 */
export function middleware(_request: NextRequest) {
  // Truthiness, not nullishness — an unset env var can arrive as ''.
  // See CONTRIBUTING.md §8.
  const allowOps = process.env.NODE_ENV === 'development' || Boolean(process.env.OPS_PREVIEW);

  if (!allowOps) {
    return new NextResponse('Not found', { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/ops/:path*'],
};
