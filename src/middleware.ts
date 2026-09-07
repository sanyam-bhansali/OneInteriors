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
  // An EXPLICIT allowed value, not truthiness.
  //
  // On Vercel NODE_ENV is always 'production', so this one variable is the
  // whole gate. `Boolean(process.env.OPS_PREVIEW)` would open it for the
  // strings "false", "0" and "off" — and setting it to "false" is exactly what
  // someone would do to turn it off. Only the literal "1" opens it.
  const allowOps =
    process.env.NODE_ENV === 'development' || process.env.OPS_PREVIEW?.trim() === '1';

  if (!allowOps) {
    return new NextResponse('Not found', { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  // '/ops' is listed separately from '/ops/:path*'. The quantifier probably
  // covers the bare path, but "probably" is not good enough for the gate on an
  // unauthenticated admin index that lists legal names and GSTINs.
  matcher: ['/ops', '/ops/:path*'],
};
