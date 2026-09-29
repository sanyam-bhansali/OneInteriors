import 'server-only';

/**
 * Moving or cancelling a booked call by its private link. Rules in manage.ts.
 * The token is the whole authorisation — it was sent only to the customer —
 * so nothing here reveals anything a link-holder would not already know.
 */

import { Prisma } from '@prisma/client';
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { resolveSiteUrl } from '@/lib/site';
import { sendCallBooked } from '@/modules/auth/email';
import { availableSlots } from './availability';
import { changeState, type ChangeState } from './manage';
import { icsFor, slotLabel, SLOT_MINS } from './slots';

export interface ManagedCall {
  id: string;
  token: string;
  scheduledFor: Date | null;
  status: string;
  studioNames: string[];
  state: ChangeState;
}

export async function callByToken(token: string, now = new Date()): Promise<ManagedCall | null> {
  if (!hasDatabase()) return null;
  try {
    const c = await prisma.consultation.findUnique({
      where: { manageToken: token },
      select: { id: true, status: true, scheduledFor: true, studioIds: true },
    });
    if (!c) return null;
    const studios = await prisma.studio.findMany({ where: { id: { in: c.studioIds } }, select: { id: true, tradeName: true } });
    return {
      id: c.id,
      token,
      scheduledFor: c.scheduledFor,
      status: c.status,
      studioNames: c.studioIds.map((id) => studios.find((s) => s.id === id)?.tradeName).filter((n): n is string => Boolean(n)),
      state: changeState(c, now),
    };
  } catch {
    return null;
  }
}

export type ManageResult = { ok: true } | { ok: false; error: string };

const LATE = 'It is less than an hour to your call, so it can no longer be changed here. Reply to your confirmation email and we will sort it out.';

export function manageUrl(token: string): string {
  return `${resolveSiteUrl()}/call/${token}`;
}

export async function moveCall(token: string, startsAt: string): Promise<ManageResult> {
  const c = await prisma.consultation.findUnique({
    where: { manageToken: token },
    select: { id: true, status: true, scheduledFor: true, expertUserId: true, contactName: true, contactEmail: true, contactPhone: true, studioIds: true },
  });
  if (!c) return { ok: false, error: 'We could not find that booking.' };
  const state = changeState(c, new Date());
  if (state === 'too-late') return { ok: false, error: LATE };
  if (state !== 'open') return { ok: false, error: 'This call can no longer be changed.' };

  const slot = (await availableSlots()).find((s) => s.startsAt === startsAt);
  if (!slot) return { ok: false, error: 'That time has just gone. Pick another.' };
  // The same expert if they are free then — they may already have read the brief.
  const expert = c.expertUserId && slot.experts.includes(c.expertUserId) ? c.expertUserId : slot.experts[0]!;
  try {
    await prisma.consultation.update({
      where: { id: c.id },
      data: { scheduledFor: new Date(slot.startsAt), expertUserId: expert },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'Somebody booked that time a moment ago. Pick another.' };
    }
    throw error;
  }
  if (c.contactEmail) {
    const email = c.contactEmail;
    after(async () => {
      const names = await studioNames(c.studioIds);
      await sendCallBooked(email, {
        kind: 'moved',
        name: c.contactName ?? '',
        when: slotLabel(slot.startsAt),
        studios: names,
        manageUrl: manageUrl(token),
        ics: icsFor({
          uid: c.id,
          startsAt: slot.startsAt,
          sequence: Math.floor(Date.now() / 1000),
          title: 'One Interiors — your expert call',
          description: `A 30-minute call about ${names.join(', ')}. We will ring ${c.contactPhone ?? 'you'}.`,
        }),
      });
    });
  }
  return { ok: true };
}

export async function cancelCall(token: string): Promise<ManageResult> {
  const c = await prisma.consultation.findUnique({
    where: { manageToken: token },
    select: { id: true, status: true, scheduledFor: true, contactName: true, contactEmail: true, studioIds: true },
  });
  if (!c) return { ok: false, error: 'We could not find that booking.' };
  const state = changeState(c, new Date());
  if (state === 'too-late') return { ok: false, error: LATE };
  if (state !== 'open') return { ok: false, error: 'This call can no longer be changed.' };
  await prisma.consultation.update({ where: { id: c.id }, data: { status: 'cancelled' } });
  if (c.contactEmail && c.scheduledFor) {
    const email = c.contactEmail;
    const iso = c.scheduledFor.toISOString();
    after(async () => {
      await sendCallBooked(email, {
        kind: 'cancelled',
        name: c.contactName ?? '',
        when: slotLabel(iso),
        studios: await studioNames(c.studioIds),
        ics: icsFor({
          uid: c.id,
          startsAt: iso,
          durationMins: SLOT_MINS,
          sequence: Math.floor(Date.now() / 1000),
          cancelled: true,
          title: 'One Interiors — your expert call',
          description: 'Cancelled.',
        }),
      });
    });
  }
  return { ok: true };
}

async function studioNames(ids: string[]): Promise<string[]> {
  const rows = await prisma.studio.findMany({ where: { id: { in: ids } }, select: { id: true, tradeName: true } });
  return ids.map((id) => rows.find((r) => r.id === id)?.tradeName).filter((n): n is string => Boolean(n));
}
