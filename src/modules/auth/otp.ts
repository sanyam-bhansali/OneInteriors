import 'server-only';

/**
 * Phone + OTP sign-in. The customer's route in.
 *
 * ## Why this replaced the emailed link for customers
 *
 * The email round trip asked someone mid-funnel to leave the site, find an
 * inbox, and come back — on a phone, often to an address they check weekly.
 * Every one of those steps loses people, and it lost them at the single worst
 * moment: after nine answered questions, one click from their quotes.
 *
 * Staff keep the emailed link. Ops and studio accounts are invite-only, created
 * by hand or by approving an application, and there is no reason to move the
 * two studios currently being onboarded onto a new auth path mid-onboarding.
 *
 * ## What is shared with the magic link, deliberately
 *
 * The same `LoginChallenge` table and the same consume-inside-a-transaction
 * shape. Two authentication implementations drift, and the one used less gets
 * the weaker review.
 *
 * Security properties:
 *
 *  - Six digits from `randomBytes`, and **only a hash is stored**. The
 *    plaintext exists in the WhatsApp message and nowhere else.
 *  - The hash covers `phone + code`, not the code alone. `tokenHash` is unique
 *    across the table, and six digits collide constantly — hashing the bare
 *    code would make two customers with the same digits a unique-constraint
 *    failure, and would let a code issued to one number be redeemed by another.
 *  - Ten-minute expiry, five attempts, and old challenges for the number are
 *    consumed when a new one is issued, so only the newest code works.
 *  - Rate limited per number, with a resend cooldown.
 *  - **Requesting a code never reveals whether an account exists.**
 */

import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { AuthChannel } from '@prisma/client';
import { createSession, hashIp, hashToken } from './session';
import { normalisePhone } from '@/modules/studio/phone';
import { sendOtp } from './whatsapp';
import { codeFromBytes, cleanCode, cleanName, isOtpShape, isValidName } from './otp-code';

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** Codes issued per number inside the window. */
const MAX_REQUESTS = 4;
const RATE_WINDOW_MINUTES = 15;
/** Stops a double-tap on "Resend" burning two of the four. */
const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Bind the code to the number it was sent to.
 *
 * Both properties matter: it makes the stored hash unique per challenge even
 * though six-digit codes repeat constantly, and it means a code observed on one
 * number cannot be replayed against another.
 */
function challengeHash(phone: string, code: string): string {
  return hashToken(`whatsapp:${phone}:${code}`);
}

export type RequestOtpResult =
  | { ok: true; devCode?: string }
  | { ok: false; reason: 'invalid_phone' | 'invalid_name' | 'rate_limited' | 'cooldown' };

/**
 * Issue a code.
 *
 * The name is taken here rather than after verification because it is what the
 * expert opens the call with, and asking for it on the same screen as the
 * number costs nothing — they are already typing.
 */
export async function requestOtp(
  rawPhone: string,
  rawName: string,
  meta: { ip?: string | null } = {},
): Promise<RequestOtpResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, reason: 'invalid_phone' };
  if (!isValidName(rawName)) return { ok: false, reason: 'invalid_name' };

  const now = Date.now();

  const since = new Date(now - RATE_WINDOW_MINUTES * 60_000);
  const recent = await prisma.loginChallenge.findMany({
    where: { identifier: phone, channel: AuthChannel.WHATSAPP, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (recent.length >= MAX_REQUESTS) return { ok: false, reason: 'rate_limited' };
  if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    return { ok: false, reason: 'cooldown' };
  }

  const code = codeFromBytes(randomBytes(4));
  const expiresAt = new Date(now + CODE_TTL_MINUTES * 60_000);

  /**
   * Retire every outstanding code for this number first.
   *
   * Otherwise "resend" leaves the previous code live for its remaining nine
   * minutes, so a number that requested four codes has four working ones —
   * quadrupling an attacker's guessing surface for no benefit to anyone. Only
   * the newest code should ever work.
   */
  await prisma.loginChallenge.updateMany({
    where: {
      identifier: phone,
      channel: AuthChannel.WHATSAPP,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  });

  await prisma.loginChallenge.create({
    data: {
      identifier: phone,
      channel: AuthChannel.WHATSAPP,
      tokenHash: challengeHash(phone, code),
      expiresAt,
      ipHash: hashIp(meta.ip),
    },
  });

  /**
   * The name is NOT stored here.
   *
   * There is no user row yet — creating one for an unverified number would let
   * anyone conjure accounts for numbers they do not own — and the challenge
   * table has nowhere to put it without a migration. It does not need one: the
   * browser that typed the name is the same browser that submits the code a
   * minute later, so it is passed through to `verifyOtp` and written when the
   * account is actually created.
   *
   * If it is lost on the way (a refresh between the two screens), the account
   * is created without a name and an expert asks on the call. A name is a
   * label, not a credential, so nothing rests on it surviving.
   */
  const sent = await sendOtp(phone, code);

  // Development with no WhatsApp credentials: hand the code back so sign-in
  // works offline. Never in production — the guard is on NODE_ENV rather than
  // on whether delivery failed, because a delivery failure in production must
  // not turn into "here is the code in the response body".
  if (!sent.delivered && process.env.NODE_ENV !== 'production') {
    return { ok: true, devCode: code };
  }

  return { ok: true };
}

export type VerifyOtpResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid_phone' | 'invalid_code' | 'expired' | 'too_many' };

/**
 * Check a code and open a session.
 *
 * Validation and consumption share one transaction, so two simultaneous
 * submissions of the same code cannot both succeed.
 */
export async function verifyOtp(
  rawPhone: string,
  rawCode: string,
  rawName: string | null,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<VerifyOtpResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, reason: 'invalid_phone' };

  const code = cleanCode(rawCode);
  if (!isOtpShape(code)) return { ok: false, reason: 'invalid_code' };

  // Carried from the first screen. Not trusted for anything but display — it
  // is whatever the form said, and it names a person rather than authorising
  // one.
  const name = rawName && isValidName(rawName) ? cleanName(rawName) : null;

  const outcome = await prisma.$transaction(async (tx) => {
    const challenge = await tx.loginChallenge.findUnique({
      where: { tokenHash: challengeHash(phone, code) },
    });

    /**
     * A wrong code finds no row, so there is nothing to increment.
     *
     * The attempt counter therefore cannot live on the challenge the guess was
     * aimed at — we do not know which one that was. Instead the newest live
     * challenge for this number carries the count, which is the right unit
     * anyway: the limit should be "five guesses at this sign-in", not "five
     * guesses at each code you happen to name".
     */
    if (!challenge) {
      const live = await tx.loginChallenge.findFirst({
        where: {
          identifier: phone,
          channel: AuthChannel.WHATSAPP,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (live) {
        const attempts = live.attempts + 1;
        await tx.loginChallenge.update({
          where: { id: live.id },
          data: {
            attempts,
            // Burn it once the budget is gone, so further guesses cannot
            // simply wait for the counter to be forgotten.
            ...(attempts >= MAX_ATTEMPTS ? { consumedAt: new Date() } : {}),
          },
        });
        if (attempts >= MAX_ATTEMPTS) return { ok: false as const, reason: 'too_many' as const };
      }

      return { ok: false as const, reason: 'invalid_code' as const };
    }

    if (challenge.consumedAt) return { ok: false as const, reason: 'invalid_code' as const };
    if (challenge.expiresAt < new Date()) return { ok: false as const, reason: 'expired' as const };
    if (challenge.attempts >= MAX_ATTEMPTS) return { ok: false as const, reason: 'too_many' as const };

    await tx.loginChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date(), attempts: { increment: 1 } },
    });

    const existing = await tx.user.findUnique({ where: { phone } });

    /**
     * First verified sign-in creates a CUSTOMER. Always CUSTOMER.
     *
     * An OPS or STUDIO account is never self-served, so the most a stranger
     * with a working phone can do here is become a customer — which is exactly
     * what we want them to be able to do.
     *
     * An existing elevated account is never demoted, and its name is not
     * overwritten by whatever was typed on a sign-in form.
     */
    const user =
      existing ??
      (await tx.user.create({
        data: {
          phone,
          name: name ?? null,
          role: 'CUSTOMER',
          phoneVerified: new Date(),
        },
      }));

    if (user.deletedAt) return { ok: false as const, reason: 'invalid_code' as const };

    if (existing) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          phoneVerified: user.phoneVerified ?? new Date(),
          // Fill a blank name; never replace one they already have.
          ...(!user.name && name ? { name } : {}),
        },
      });
    }

    return { ok: true as const, userId: user.id };
  });

  if (!outcome.ok) return outcome;

  await createSession(outcome.userId, meta);
  return { ok: true, userId: outcome.userId };
}
