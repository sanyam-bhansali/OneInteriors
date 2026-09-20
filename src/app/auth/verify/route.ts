import { NextResponse, type NextRequest } from 'next/server';
import { consumeMagicLink } from '@/modules/auth/magic-link';
import { safeNext } from '@/lib/site';
import { claimBrief } from '@/modules/brief/repository';
import { claimConsent } from '@/modules/consent/record';
import { record } from '@/modules/analytics/record';
import { prisma } from '@/lib/prisma';
import { shouldSetPassword } from '@/modules/auth/password';

/**
 * Consume a sign-in link and open a session.
 *
 * ## Why this is a Route Handler and not a page
 *
 * It writes a cookie, and **Next refuses a cookie write during a server
 * component render** — only a Server Action or a Route Handler may set one.
 * This lived at `/sign-in/verify/page.tsx` and threw on every single click:
 *
 *     Cookies can only be modified in a Server Action or Route Handler
 *       at createSession (src/modules/auth/session.ts:82)
 *       at consumeMagicLink (src/modules/auth/magic-link.ts:187)
 *       at VerifyPage (src/app/sign-in/verify/page.tsx:54)
 *
 * Which meant email sign-in never worked at all — and email is the only route
 * a studio or an ops account has, because those are created with an address and
 * no phone. The whole staff side of the product was unreachable.
 *
 * A Server Action was the other option and is worse here: it needs a form
 * submission, so a link that should sign you in on click would instead render a
 * page with a button on it.
 *
 * ## Why the errors live on a page rather than here
 *
 * "Expired" and "already used" need explaining, and a Route Handler returns a
 * response rather than a rendering. So failures redirect to
 * `/sign-in/verify?reason=…`, which is now purely the explanation screen and no
 * longer consumes anything.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const next = safeNext(request.nextUrl.searchParams.get('next'));

  const result = await consumeMagicLink(token, {
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });

  if (!result.ok) {
    return NextResponse.redirect(new URL(`/sign-in/verify?reason=${result.reason}`, request.url));
  }

  /**
   * Attach anything this browser did before signing in.
   *
   * Both are best-effort and neither may block the sign-in: a failed claim
   * costs a brief, a failed sign-in costs the customer.
   */
  const { claimed, anonKey } = await claimBrief(result.userId);
  await claimConsent(result.userId, anonKey);
  if (claimed) await record('brief.claimed');
  await record('signin.completed');

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { role: true, passwordHash: true },
  });

  /**
   * Where they were headed wins.
   *
   * Somebody who clicked "get my quotes", signed in, and landed on the
   * marketing homepage has been sent back to the start of a journey they were
   * four steps into.
   */
  const destination =
    next ??
    (user?.role === 'OPS' || user?.role === 'ADMIN'
      ? '/ops'
      : user?.role === 'STUDIO'
        ? '/studio'
        : claimed
          ? '/match'
          : '/');

  /**
   * A staff account with no password yet is asked for one, once, here.
   *
   * This is the whole point of putting it on THIS redirect rather than on a
   * settings page: a studio's first link is the email telling them they are on
   * the roster, and that is the only moment we can be sure they are reading
   * anything we send. Thirty seconds now, against an email nobody opens later.
   *
   * `first=1` changes the wording and offers a skip — the screen refuses to be
   * a wall in front of somebody who came to read their approval on a phone
   * between site visits. Where they were going is carried through, so setting
   * a password drops them exactly where this link would have taken them.
   */
  if (user && shouldSetPassword(user)) {
    const url = new URL('/set-password', request.url);
    url.searchParams.set('next', destination);
    url.searchParams.set('first', '1');
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
