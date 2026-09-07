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
import { AuthChannel } from '@prisma/client';
import { createSession, hashIp, hashToken, newToken } from './session';
import { sendMagicLink } from './email';

const TOKEN_TTL_MINUTES = 15;
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
  | { ok: true; devLink?: string }
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
  meta: { ip?: string | null; baseUrl: string },
): Promise<RequestResult> {
  const email = normaliseEmail(rawEmail);
  if (!isValidEmail(email)) return { ok: false, reason: 'invalid_email' };

  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000);
  const recent = await prisma.loginChallenge.count({
    where: { identifier: email, createdAt: { gte: since } },
  });
  if (recent >= MAX_REQUESTS) return { ok: false, reason: 'rate_limited' };

  const token = newToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

  await prisma.loginChallenge.create({
    data: {
      identifier: email,
      channel: AuthChannel.EMAIL,
      tokenHash: hashToken(token),
      expiresAt,
      ipHash: hashIp(meta.ip),
    },
  });

  const link = `${meta.baseUrl}/sign-in/verify?token=${encodeURIComponent(token)}`;

  // Only send to addresses we actually know. An unknown address still gets a
  // successful-looking response above, it just receives no email — so the
  // endpoint cannot be used to enumerate accounts.
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.deletedAt) {
    const sent = await sendMagicLink(email, link);
    // In development with no email provider configured, hand the link back so
    // sign-in works offline. Never in production.
    if (!sent.delivered && process.env.NODE_ENV !== 'production') {
      return { ok: true, devLink: link };
    }
  }

  return { ok: true };
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

    const user = await tx.user.findUnique({ where: { email: challenge.identifier } });
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
