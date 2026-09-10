import 'server-only';

/**
 * The shared, read-only comparison.
 *
 * ## Why this is the highest-value screen in the product
 *
 * Nobody spends nine lakh rupees alone. In practice the decision involves a
 * spouse and often parents, and the person who answered our nine questions is
 * rarely the only one who has to be convinced. Until this existed, the second
 * decision-maker's entire experience of us was somebody reciting four price
 * ranges from memory over dinner — which is where a carefully built comparison
 * goes to die.
 *
 * It is also the only referral mechanic we get honestly. A shared link is a
 * recommendation the sender has to stand behind, which is worth more than any
 * incentive scheme and costs nothing.
 *
 * ## The security shape
 *
 * The token is a BEARER credential: holding the URL is the whole of the
 * authorisation. That is deliberate — the recipient has no account and forcing
 * them to make one would defeat the purpose — but it sets hard limits on what
 * the page may contain and what it may do:
 *
 *  - **Contains** the brief's shape (home, budget band, styles) and the
 *    quotes. Nothing that identifies a person: no name, no email, no phone.
 *    Those are not on the Brief row at all, and this is why they should stay
 *    off it.
 *  - **Does nothing.** A reader cannot request an introduction, change an
 *    answer, generate a fresh quote, or see whether anyone else opened it.
 *    Every action on the shared page is a link back to the front door, where
 *    they would start their own brief.
 *
 * Revocation is clearing the column, which is why the token is nullable rather
 * than minted for every brief at creation.
 */

import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { readAnonKey } from './repository';
import { rowToBrief } from './mapping';
import { isShareTokenShape } from './share-token';
import type { Brief } from './types';

/**
 * 24 bytes of CSPRNG, base64url.
 *
 * 192 bits. Enormously more than the birthday bound needs, and the reason is
 * not collision — it is that this token is guessable-by-enumeration or it is
 * not, and there is no middle setting. A short token on a URL that reveals
 * somebody's budget is not worth the twelve characters it saves.
 */
function newShareToken(): string {
  return randomBytes(24).toString('base64url');
}

export type ShareResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'no_brief' | 'unavailable' };

/**
 * Mint a share token for the caller's own brief, or return the existing one.
 *
 * Idempotent on purpose. Someone who clicks "share" twice should get the same
 * link, not a second one — two live tokens for the same brief means revoking
 * the one you remember and leaving the one you forgot.
 */
export async function shareLinkForCurrentBrief(): Promise<ShareResult> {
  if (!hasDatabase()) return { ok: false, reason: 'unavailable' };

  try {
    const user = await getCurrentUser();
    const anonKey = user ? null : await readAnonKey();

    // The caller must own the brief. Not "know its id" — own it.
    const where = user ? { userId: user.id } : anonKey ? { anonKey } : null;
    if (!where) return { ok: false, reason: 'no_brief' };

    const existing = await prisma.brief.findUnique({
      where,
      select: { id: true, shareToken: true, completedAt: true },
    });

    if (!existing || !existing.completedAt) return { ok: false, reason: 'no_brief' };
    if (existing.shareToken) return { ok: true, token: existing.shareToken };

    const token = newShareToken();
    await prisma.brief.update({
      where: { id: existing.id },
      data: { shareToken: token, sharedAt: new Date() },
    });

    return { ok: true, token };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** Drop the link. Anyone holding the old URL immediately gets nothing. */
export async function revokeShareLink(): Promise<{ ok: boolean }> {
  if (!hasDatabase()) return { ok: false };

  try {
    const user = await getCurrentUser();
    const anonKey = user ? null : await readAnonKey();
    const where = user ? { userId: user.id } : anonKey ? { anonKey } : null;
    if (!where) return { ok: false };

    await prisma.brief.update({
      where,
      data: { shareToken: null, sharedAt: null },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export interface SharedBrief {
  brief: Brief;
  sharedAt: Date | null;
}

/**
 * Read a brief by its share token.
 *
 * Returns null for a missing, revoked or malformed token — all three are the
 * same answer to the reader, deliberately. Saying "this link was revoked"
 * rather than "no such link" would confirm to a stranger that the URL was once
 * real, which tells them enumeration is worth continuing.
 */
export async function briefByShareToken(token: string): Promise<SharedBrief | null> {
  if (!hasDatabase()) return null;

  // Cheap shape check before touching the database. Lives in a sibling module
  // without `server-only` so it can be tested — see share-token.ts.
  if (!isShareTokenShape(token)) return null;

  try {
    const row = await prisma.brief.findUnique({ where: { shareToken: token } });
    if (!row || !row.completedAt) return null;
    return { brief: rowToBrief(row), sharedAt: row.sharedAt };
  } catch {
    return null;
  }
}
