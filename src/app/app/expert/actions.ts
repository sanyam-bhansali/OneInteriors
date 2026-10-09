'use server';

/**
 * Book the expert call in one tap (trust fix 1, 9 Oct 2026).
 *
 * The customer verified their number at "quotes ready", which signed them in
 * and moved their brief onto their account. So the name and number are
 * already ours: this books with those rather than sending them to a form that
 * asks again. It goes through `requestConsultation`, the same path the
 * website's /expert form uses, so there is still one way a call gets booked.
 */

import { getCurrentUser } from '@/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { requestConsultation } from '@/modules/consultation/request';

export type BookResult = { ok: true; scheduledFor: string | null; phone: string } | { ok: false; error: string; signIn?: boolean };

export async function bookExpertCallAction(input: { startsAt: string; studioIds: string[] }): Promise<BookResult> {
  if (!hasDatabase()) return { ok: false, error: 'Calls cannot be booked on this test build.' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, signIn: true, error: 'Verify your number first, so your expert knows who to ring.' };

  const brief = await prisma.brief.findUnique({
    where: { userId: user.id },
    select: { id: true, contactName: true, contactPhone: true },
  });
  if (!brief) return { ok: false, error: 'We could not find your brief. Finish the questions and try again.' };

  const phone = brief.contactPhone ?? user.phone ?? '';
  const result = await requestConsultation({
    briefId: brief.id,
    studioIds: input.studioIds.slice(0, 5),
    contactName: brief.contactName ?? user.name ?? '',
    contactPhone: phone,
    contactEmail: user.email ?? '',
    askedAbout: '',
    preferredTimes: '',
    startsAt: input.startsAt.slice(0, 40),
    // Given at "quotes ready": "Share my home details and answers with these studios".
    shareConsent: true,
  });

  if (!result.ok) {
    return { ok: false, error: result.errors.startsAt ?? result.errors.form ?? Object.values(result.errors)[0] ?? 'That did not go through. Try again.' };
  }
  return { ok: true, scheduledFor: result.scheduledFor ?? null, phone };
}
