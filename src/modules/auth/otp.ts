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
import { isProduction, showOtpOnScreen } from '@/lib/env';
import { createSession, hashIp, hashToken, type SessionMeta } from './session';
import { normalisePhone } from '@/modules/studio/phone';
import type { StudioRoleName } from '@/modules/studio/roles';
import { bucketFor, consume } from '@/modules/rate-limit/store';
import { send as sendStudioMessage } from '@/modules/messaging/sender';
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
 * Code requests per address per hour, across every number.
 *
 * The per-number limit above stops one number being flooded; it does nothing
 * against one script walking a thousand numbers, each one a paid WhatsApp
 * message (or SMS) and, on the studio side, a probe of who is on a team.
 * The IP hash was stored on every challenge but never checked.
 *
 * Generous on purpose: Indian mobile networks put many phones behind one
 * address (carrier-grade NAT), and a limit that a busy Jio tower trips
 * refuses real customers. Twenty an hour is nothing to a person and a hard
 * ceiling to a script. Keyed by the hashed address, never the raw one.
 *
 * It uses the shared limiter, which fails OPEN if the database is down
 * (rate-limit/store.ts). That is safe here: a request it lets through still
 * has to write a challenge to the same database, so an outage refuses it
 * anyway, and the guessing limit lives on the challenge, not here.
 */
export const OTP_IP_LIMIT = { max: 20, windowMs: 60 * 60_000 };

/** The rate-limit bucket for this address. Hashed: no raw IP is ever stored. */
export function otpIpBucket(ip: string | null | undefined): string {
  return bucketFor('otp-ip', hashIp(ip) ?? 'unknown');
}

/**
 * The studio sign-in's code-on-screen shortcut: the code, when nothing
 * delivered it AND this is not a production build. On Vercel every
 * deployment — previews included — is a production build, so this is local
 * development only, whatever any env var says.
 */
export function studioDevCode(delivered: boolean, code: string): string | undefined {
  if (delivered || isProduction()) return undefined;
  return code;
}

/**
 * Who this number is on a studio's team, for the studio sign-in. Null when
 * the number has no account, the account is gone, it is a customer's, or it
 * belongs to nobody's team.
 *
 * A CUSTOMER account with a membership should not exist (Settings → Team
 * refuses to add one), and if it ever does it is refused here too: the
 * studio door never signs anyone in as a customer.
 */
async function studioMemberByPhone(
  db: Pick<typeof prisma, 'user'>,
  phone: string,
): Promise<{ userId: string; memberId: string; role: StudioRoleName; status: 'INVITED' | 'ACTIVE' | 'SUSPENDED'; phoneVerified: Date | null } | null> {
  const user = await db.user.findUnique({
    where: { phone },
    select: {
      id: true,
      role: true,
      deletedAt: true,
      phoneVerified: true,
      studioMember: { select: { id: true, role: true, status: true } },
    },
  });
  if (!user || user.deletedAt || user.role === 'CUSTOMER' || !user.studioMember) return null;
  return {
    userId: user.id,
    memberId: user.studioMember.id,
    role: user.studioMember.role,
    status: user.studioMember.status,
    phoneVerified: user.phoneVerified,
  };
}

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

/** Refusals only the studio sign-in gives: "ask your studio owner". */
export type StudioRefusal = 'not_member' | 'suspended';

export type RequestOtpResult =
  | { ok: true; devCode?: string }
  | { ok: false; reason: 'invalid_phone' | 'invalid_name' | 'rate_limited' | 'cooldown' | StudioRefusal };

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
  /**
   * `nameOptional`: the phone app's "I already have an account" sign-in asks
   * for the number alone (design screen #12, returning customers). A name
   * that is given must still be valid.
   */
  meta: {
    ip?: string | null;
    nameOptional?: boolean;
    /**
     * The studio sign-in (/studio/sign-in). The number must belong to an
     * invited or active member of a studio's team, or no code is sent at
     * all; the code goes through MessageSender (studio template, SMS
     * fallback); and the code is shown on screen in local development only.
     *
     * Refusing before sending does say "this number is not on a team" to
     * whoever typed it. That is the brief's design ("ask your studio
     * owner") and the cheaper evil: the alternative is sending paid codes
     * to any number typed into the studio page, and a supervisor who typed
     * one digit wrong waiting for a message that never comes. The per-IP
     * limit below caps how fast anyone can ask.
     */
    studio?: boolean;
  } = {},
): Promise<RequestOtpResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, reason: 'invalid_phone' };
  if (!(meta.studio || (meta.nameOptional && !rawName.trim())) && !isValidName(rawName)) {
    return { ok: false, reason: 'invalid_name' };
  }

  /* Per address first, before anything is looked up, so a refusal below
     still counts against whoever is asking. */
  const byIp = await consume(otpIpBucket(meta.ip), OTP_IP_LIMIT);
  if (!byIp.allowed) return { ok: false, reason: 'rate_limited' };

  if (meta.studio) {
    const member = await studioMemberByPhone(prisma, phone);
    if (!member) return { ok: false, reason: 'not_member' };
    if (member.status === 'SUSPENDED') return { ok: false, reason: 'suspended' };
  }

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
  if (meta.studio) {
    const sent = await sendStudioMessage(phone, { kind: 'code', code });
    /* Local development only — `studioDevCode` is the whole rule, pinned by
       tests/studio-sign-in.test.ts. Deliberately NOT `showOtpOnScreen()`:
       no flag, on any deployment, puts a studio code on the page. */
    const devCode = studioDevCode(sent.delivered, code);
    return devCode ? { ok: true, devCode } : { ok: true };
  }

  const sent = await sendOtp(phone, code);

  // Local development with no WhatsApp credentials: hand the code back so
  // sign-in works offline.
  if (!sent.delivered && process.env.NODE_ENV !== 'production') {
    return { ok: true, devCode: code };
  }

  /**
   * The pre-launch escape hatch, for deployed builds.
   *
   * On Vercel `NODE_ENV` is always 'production', so the check above never
   * fires there — which meant that until Meta approved the template, nobody
   * could get past the sign-in gate on the deployed site and everything behind
   * it was untestable.
   *
   * `showOtpOnScreen()` is off unless explicitly set, and refuses to work at
   * all once the roster is declared real. Read its comment before touching
   * this: with it on, the OTP proves nothing whatsoever.
   *
   * Returned regardless of whether delivery succeeded, deliberately — the
   * whole point is not depending on delivery.
   */
  if (showOtpOnScreen()) {
    return { ok: true, devCode: code };
  }

  return { ok: true };
}

export type VerifyOtpResult =
  | {
      ok: true;
      userId: string;
      /** Set only when `meta.bearer` asked for the token rather than a cookie. */
      token?: string;
      /** The studio sign-in: their role on the team, for where they land. */
      studioRole?: StudioRoleName;
    }
  | { ok: false; reason: 'invalid_phone' | 'invalid_code' | 'expired' | 'too_many' | StudioRefusal };

export interface VerifyOtpMeta extends SessionMeta {
  /**
   * The studio sign-in. Signs in as the studio member who owns this number
   * (INVITED becomes ACTIVE on this first sign-in); anyone else is refused
   * and no account is created — the customer branch below never runs.
   */
  studio?: boolean;
  /** The language they chose on the studio sign-in, as a User.locale ("hi-IN"). */
  locale?: string;
}

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
  meta: VerifyOtpMeta = {},
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

    /**
     * The studio door. Checked again here, not only when the code was
     * asked for: a member suspended in the ten minutes between is refused,
     * and a code asked for on the customer page and typed on this one still
     * has to belong to a team member. Nothing is created on this branch.
     */
    if (meta.studio) {
      const member = await studioMemberByPhone(tx, phone);
      if (!member) return { ok: false as const, reason: 'not_member' as const };
      if (member.status === 'SUSPENDED') return { ok: false as const, reason: 'suspended' as const };
      const now = new Date();
      await tx.studioMember.update({
        where: { id: member.memberId },
        data: { lastSeenAt: now, ...(member.status === 'INVITED' ? { status: 'ACTIVE' as const } : {}) },
      });
      await tx.user.update({
        where: { id: member.userId },
        data: { phoneVerified: member.phoneVerified ?? now, ...(meta.locale ? { locale: meta.locale } : {}) },
      });
      return { ok: true as const, userId: member.userId, studioRole: member.role };
    }

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

  const token = await createSession(outcome.userId, meta);
  const studioRole = 'studioRole' in outcome ? { studioRole: outcome.studioRole } : {};
  return meta.bearer ? { ok: true, userId: outcome.userId, token, ...studioRole } : { ok: true, userId: outcome.userId, ...studioRole };
}
