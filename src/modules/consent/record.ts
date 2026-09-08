import 'server-only';

/**
 * Recording and reading consent.
 *
 * The table is **append-only in spirit**: a change of mind writes a new row
 * rather than editing the old one, and withdrawal stamps `withdrawnAt` instead
 * of deleting. That is deliberate — the Act's requirement is that we can show
 * what was agreed, when, and against which notice. A table that overwrites
 * itself can prove the present but not the past, and the past is exactly what
 * gets asked about.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { readAnonKey, ensureAnonKey } from '@/modules/brief/repository';
import {
  POLICY_VERSION,
  mayContact as mayContactPure,
  type ConsentPurpose,
  type ConsentRecord,
} from './policy';

export interface ConsentDecision {
  purpose: ConsentPurpose;
  granted: boolean;
}

/**
 * Record a set of decisions taken together, against one notice.
 *
 * A refusal is recorded as explicitly as an agreement. Storing only the yeses
 * would leave "they said no" and "we never asked" indistinguishable, and those
 * two need very different handling if anyone ever queries it.
 */
export async function recordConsent(
  decisions: ConsentDecision[],
  source: string,
): Promise<{ ok: boolean }> {
  if (!hasDatabase() || decisions.length === 0) return { ok: false };

  try {
    const user = await getCurrentUser();
    const anonKey = user ? null : await ensureAnonKey();

    await prisma.consent.createMany({
      data: decisions.map((d) => ({
        userId: user?.id ?? null,
        anonKey,
        purpose: d.purpose as Prisma.ConsentCreateManyInput['purpose'],
        granted: d.granted,
        source,
        policyVersion: POLICY_VERSION,
      })),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Every decision this person has recorded, oldest first. */
export async function consentHistory(): Promise<ConsentRecord[]> {
  if (!hasDatabase()) return [];

  const user = await getCurrentUser();
  const anonKey = await readAnonKey();

  const where = user
    ? { userId: user.id }
    : anonKey
      ? { anonKey }
      : null;
  if (!where) return [];

  const rows = await prisma.consent.findMany({ where, orderBy: { grantedAt: 'asc' } });

  return rows.map((r) => ({
    purpose: r.purpose as ConsentPurpose,
    granted: r.granted,
    policyVersion: r.policyVersion,
    withdrawnAt: r.withdrawnAt,
  }));
}

export async function mayContact(purpose: ConsentPurpose): Promise<boolean> {
  return mayContactPure(await consentHistory(), purpose);
}

/**
 * Withdraw a consent.
 *
 * Withdrawal has to be as easy as giving it, so this takes no more than the
 * purpose. It stamps every live grant for that purpose rather than only the
 * latest, because a duplicate row left un-withdrawn is exactly the sort of
 * thing that later authorises a message nobody meant to send.
 */
export async function withdrawConsent(purpose: ConsentPurpose): Promise<{ ok: boolean }> {
  if (!hasDatabase()) return { ok: false };

  const user = await getCurrentUser();
  const anonKey = await readAnonKey();
  const owner = user ? { userId: user.id } : anonKey ? { anonKey } : null;
  if (!owner) return { ok: false };

  try {
    await prisma.consent.updateMany({
      where: {
        ...owner,
        purpose: purpose as Prisma.ConsentWhereInput['purpose'],
        granted: true,
        withdrawnAt: null,
      },
      data: { withdrawnAt: new Date() },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Attach anonymous consent rows to the account that just signed in.
 *
 * Called alongside `claimBrief`. Consent given anonymously is still consent —
 * losing it here would mean re-asking someone who has already answered, which
 * is both irritating and looks like we did not listen.
 */
export async function claimConsent(userId: string, anonKey: string | null): Promise<void> {
  if (!hasDatabase() || !anonKey) return;

  try {
    await prisma.consent.updateMany({
      where: { anonKey, userId: null },
      data: { userId, anonKey: null },
    });
  } catch {
    /* Never block a sign-in on this. */
  }
}
