import 'server-only';

/**
 * Book the expert call in one tap (trust fix 1, 9 Oct 2026), for the
 * website's /app expert screen and the phone app's `POST /expert/book`.
 *
 * The customer gave their number at "quotes ready" (signed in by it when the
 * WhatsApp code is on, or saved on the brief this browser owns when it is
 * off), so this books with that number rather than asking again. It goes
 * through `requestConsultation`, the same path the website's /expert form
 * uses, so there is still one way a call gets booked.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { readAnonKey } from '@/modules/brief/repository';
import { requestConsultation, MAX_STUDIOS } from './request';

export type BookResult =
  | { ok: true; scheduledFor: string | null; phone: string }
  | { ok: false; error: string; signIn?: boolean; slotGone?: boolean };

export async function bookExpertCall(input: { startsAt: string; studioIds: string[] }): Promise<BookResult> {
  if (!hasDatabase()) return { ok: false, error: 'Calls cannot be booked on this test build.' };

  const user = await getCurrentUser();
  const anonKey = user ? null : await readAnonKey();
  const brief = user
    ? await prisma.brief.findUnique({ where: { userId: user.id }, select: { id: true, contactName: true, contactPhone: true } })
    : anonKey
      ? await prisma.brief.findUnique({ where: { anonKey }, select: { id: true, contactName: true, contactPhone: true } })
      : null;
  if (!brief) return { ok: false, signIn: true, error: 'We could not find your brief. Finish the questions and try again.' };
  if (!brief.contactPhone && !user?.phone) {
    return { ok: false, signIn: true, error: 'Add your number first, so your expert knows who to ring.' };
  }

  const phone = brief.contactPhone ?? user?.phone ?? '';
  const result = await requestConsultation({
    briefId: brief.id,
    studioIds: input.studioIds.slice(0, MAX_STUDIOS),
    contactName: brief.contactName ?? user?.name ?? '',
    contactPhone: phone,
    contactEmail: user?.email ?? '',
    askedAbout: '',
    preferredTimes: '',
    startsAt: input.startsAt.slice(0, 40),
    // Given at "quotes ready": "Share my home details and answers with these studios".
    shareConsent: true,
  });

  if (!result.ok) {
    if (result.errors.startsAt) return { ok: false, slotGone: true, error: result.errors.startsAt };
    return { ok: false, error: result.errors.form ?? Object.values(result.errors)[0] ?? 'That did not go through. Try again.' };
  }
  return { ok: true, scheduledFor: result.scheduledFor ?? null, phone };
}

/**
 * The studios the call is about when the phone app does not name them: the
 * shortlist they sent after verifying (`journey/submit`), in their order.
 * Empty when there is none; the caller then uses the brief's matches.
 */
export async function shortlistedStudioIds(briefId: string): Promise<string[]> {
  const rows = await prisma.shortlist.findMany({ where: { briefId }, orderBy: { position: 'asc' }, select: { studioId: true }, take: MAX_STUDIOS });
  return rows.map((r) => r.studioId);
}
