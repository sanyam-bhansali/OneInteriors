import 'server-only';

/**
 * Email magic-link sign-in.
 *
 * Carries ops and studio staff. Customers get WhatsApp OTP when Meta approval
 * lands — and it will reuse `LoginChallenge` and `consume()` below rather than
 * being a second, drifting implementation.
 *
 * Security properties, each deliberate:
 *
 *  - The token is 256 bits of CSPRNG and **only its hash is stored**. The
 *    plaintext exists in the email and nowhere else.
 *  - Single use. `consumedAt` is set inside the same transaction that validates
 *    it, so a replayed link fails even under a race.
 *  - Short expiry (15 minutes) and an attempt counter.
 *  - **Requesting a link never reveals whether an account exists.** The caller
 *    gets the same answer either way; enumerating our ops team's email
 *    addresses should not be a feature.
 *  - Rate limited per identifier.
 */

import { prisma } from '@/lib/prisma';
import { safeNext } from '@/lib/site';
import { AuthChannel } from '@prisma/client';
import { createSession, hashIp, hashToken, newToken } from './session';
import { sendMagicLink, sendStudioWelcome } from './email';

const TOKEN_TTL_MINUTES = 15;

/**
 * A link somebody did not ask for needs longer than one they did.
 *
 * Fifteen minutes is right for a sign-in the person triggered thirty seconds
 * ago and is waiting on. It is wrong for an approval landing unannounced in a
 * studio owner's inbox on a Tuesday afternoon — they read it after the site
 * visit, the link is dead, and their first experience of us is an error page.
 *
 * Seven days, and the security position is unchanged: the token is still
 * single-use, still hashed at rest, still rate-limited, and still only ever
 * sent to an address we already approved.
 */
const INVITE_TTL_MINUTES = 60 * 24 * 7;
const MAX_ATTEMPTS = 5;
/** Per identifier, within the window below. */
const MAX_REQUESTS = 5;
const RATE_WINDOW_MINUTES = 15;

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(raw: string): boolean {
  return EMAIL_SHAPE.test(normaliseEmail(raw));
}

export type RequestResult =
  | {
      ok: true;
      devLink?: string;
      /**
       * Did the email actually leave the building?
       *
       * `false` when no provider is configured, or the provider refused. This
       * is for INTERNAL callers only — ops approving a studio needs to know the
       * link did not send, because otherwise they tell a studio to check their
       * inbox for a message nobody wrote.
       *
       * The customer-facing sign-in form must ignore it. Its message is
       * deliberately identical whether or not an account exists, and varying it
       * by delivery would turn the form into an account-enumeration oracle.
       */
      delivered?: boolean;
    }
  | { ok: false; reason: 'invalid_email' | 'rate_limited' };

/**
 * Issue a sign-in link.
 *
 * Returns the same shape whether or not the address belongs to a user — the
 * only failures surfaced are ones the caller can act on (a malformed address,
 * too many attempts).
 */
export async function requestMagicLink(
  rawEmail: string,
  meta: {
    ip?: string | null;
    baseUrl: string;
    next?: string | null;
    /**
     * What this link is for. `invite` swaps the plain sign-in email for the
     * welcome, and gives the token seven days instead of fifteen minutes.
     */
    purpose?: 'sign-in' | 'invite';
    /** For the welcome: who it is addressed to and which studio. */
    invite?: { contactName: string | null; studioName: string };
  },
): Promise<RequestResult> {
  const email = normaliseEmail(rawEmail);
  if (!isValidEmail(email)) return { ok: false, reason: 'invalid_email' };

  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000);
  const recent = await prisma.loginChallenge.count({
    where: { identifier: email, createdAt: { gte: since } },
  });
  if (recent >= MAX_REQUESTS) return { ok: false, reason: 'rate_limited' };

  const invited = meta.purpose === 'invite';
  const token = newToken();
  const expiresAt = new Date(
    Date.now() + (invited ? INVITE_TTL_MINUTES : TOKEN_TTL_MINUTES) * 60_000,
  );

  await prisma.loginChallenge.create({
    data: {
      identifier: email,
      channel: AuthChannel.EMAIL,
      tokenHash: hashToken(token),
      expiresAt,
      ipHash: hashIp(meta.ip),
    },
  });

  const next = safeNext(meta.next);

  /**
   * `/auth/verify` is a Route Handler, not a page.
   *
   * It has to be: consuming the link writes a session cookie, and Next refuses
   * a cookie write during a server component render. This pointed at
   * `/sign-in/verify` — a page — and every click threw "Cookies can only be
   * modified in a Server Action or Route Handler", which meant email sign-in
   * had never worked for anybody. `/sign-in/verify` is now the error screen
   * that handler redirects to.
   */
  const link =
    `${meta.baseUrl}/auth/verify?token=${encodeURIComponent(token)}` +
    (next ? `&next=${encodeURIComponent(next)}` : '');

  /**
   * Customers get an account on first sign-in; staff and studios do not.
   *
   * The original rule — send only to addresses that already have a user —
   * meant a customer could never sign in at all, because nothing creates
   * customer users. The sign-in gate in front of the quotes page was therefore
   * a dead end for every real customer, which is precisely what it did.
   *
   * OPS and STUDIO accounts stay invite-only: ops accounts are created by
   * hand, studio accounts by approving an application. Neither can be
   * self-served by typing an address here, because the account created below
   * is always a CUSTOMER.
   */
  const user = await prisma.user.findUnique({ where: { email } });
  const deliverable = user ? !user.deletedAt : true;

  if (deliverable) {
    const sent = invited
      ? await sendStudioWelcome(email, link, {
          contactName: meta.invite?.contactName ?? null,
          studioName: meta.invite?.studioName ?? 'your studio',
        })
      : await sendMagicLink(email, link);
    // In development with no email provider configured, hand the link back so
    // sign-in works offline. Never in production.
    if (!sent.delivered && process.env.NODE_ENV !== 'production') {
      return { ok: true, devLink: link, delivered: false };
    }
    return { ok: true, delivered: sent.delivered };
  }

  // No deliverable account. Reported as delivered so the caller cannot tell the
  // difference — see the note on `RequestResult`.
  return { ok: true, delivered: true };
}

export type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' | 'no_account' };

/**
 * Validate a token and open a session.
 *
 * The consume-and-validate happens in one transaction. Without that, two
 * simultaneous requests with the same link could both pass validation before
 * either marked it used.
 */
export async function consumeMagicLink(
  token: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<ConsumeResult> {
  if (!token) return { ok: false, reason: 'invalid' };

  const tokenHash = hashToken(token);

  const outcome = await prisma.$transaction(async (tx) => {
    const challenge = await tx.loginChallenge.findUnique({ where: { tokenHash } });
    if (!challenge) return { ok: false as const, reason: 'invalid' as const };
    if (challenge.consumedAt) return { ok: false as const, reason: 'used' as const };
    if (challenge.expiresAt < new Date()) return { ok: false as const, reason: 'expired' as const };
    if (challenge.attempts >= MAX_ATTEMPTS) return { ok: false as const, reason: 'invalid' as const };

    // Mark used immediately, inside the transaction.
    await tx.loginChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date(), attempts: { increment: 1 } },
    });

    const existing = await tx.user.findUnique({ where: { email: challenge.identifier } });

    // First sign-in creates a CUSTOMER. Always CUSTOMER — an OPS or STUDIO
    // account is never self-served, so the worst a stranger with a working
    // inbox can do here is become a customer, which is the point.
    const user =
      existing ??
      (await tx.user.create({
        data: { email: challenge.identifier, role: 'CUSTOMER', emailVerified: new Date() },
      }));
    if (!user || user.deletedAt) return { ok: false as const, reason: 'no_account' as const };

    if (!user.emailVerified) {
      await tx.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    }

    return { ok: true as const, userId: user.id };
  });

  if (!outcome.ok) return outcome;

  await createSession(outcome.userId, meta);
  return { ok: true, userId: outcome.userId };
}

/** Housekeeping — expired challenges are noise, and noise hides attacks. */
export async function purgeExpiredChallenges(): Promise<number> {
  const { count } = await prisma.loginChallenge.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  return count;
}
