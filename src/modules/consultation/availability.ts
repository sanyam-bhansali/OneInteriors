import 'server-only';

/**
 * The expert calendar, read from the database — hours, blocked days and live
 * bookings — and turned into open slots by `slots.ts`.
 *
 * Reads never throw into a page: no database, a missing table in the window
 * between a deploy and its migration, or nobody with hours set, all come back
 * as "no slots", and the expert page falls back to "tell us when suits you".
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { requireRole } from '@/modules/auth/session';
import { checkHours, istDate, openSlots, type Slot, type WeeklyHours } from './slots';

export async function availableSlots(now = new Date()): Promise<Slot[]> {
  if (!hasDatabase()) return [];
  try {
    const [hours, blocks, booked] = await Promise.all([
      prisma.expertHours.findMany({ take: 500 }),
      prisma.expertBlock.findMany({ where: { day: { gte: istDate(now) } }, take: 500 }),
      prisma.consultation.findMany({
        where: { status: 'scheduled', scheduledFor: { gte: now }, expertUserId: { not: null } },
        select: { expertUserId: true, scheduledFor: true },
        take: 2000,
      }),
    ]);
    const blocked = new Map<string, Set<string>>();
    for (const b of blocks) blocked.set(b.expertUserId, (blocked.get(b.expertUserId) ?? new Set()).add(b.day));
    const taken = new Map<string, Set<string>>();
    for (const c of booked) {
      if (!c.expertUserId || !c.scheduledFor) continue;
      taken.set(c.expertUserId, (taken.get(c.expertUserId) ?? new Set()).add(c.scheduledFor.toISOString()));
    }
    return openSlots({ hours: hours as WeeklyHours[], blocked, booked: taken, now });
  } catch (error) {
    console.error('[expert] availability unavailable', error instanceof Error ? error.name : 'unknown');
    return [];
  }
}

// ── Ops: setting the hours ─────────────────────────────────────

export type HoursResult = { ok: true } | { ok: false; error: string };

export async function addHours(expertUserId: string, h: { weekday: number; startMin: number; endMin: number }): Promise<HoursResult> {
  await requireRole('OPS');
  const problem = checkHours(h);
  if (problem) return { ok: false, error: problem };
  const expert = await prisma.user.findUnique({ where: { id: expertUserId }, select: { role: true } });
  if (!expert || (expert.role !== 'OPS' && expert.role !== 'ADMIN')) {
    return { ok: false, error: 'Hours can only be set for a member of our team.' };
  }
  await prisma.expertHours.create({ data: { expertUserId, ...h } });
  return { ok: true };
}

export async function removeHours(id: string): Promise<HoursResult> {
  await requireRole('OPS');
  await prisma.expertHours.delete({ where: { id } }).catch(() => null);
  return { ok: true };
}

export async function blockDay(expertUserId: string, day: string, reason: string): Promise<HoursResult> {
  await requireRole('OPS');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: 'A date, please.' };
  await prisma.expertBlock.upsert({
    where: { expertUserId_day: { expertUserId, day } },
    create: { expertUserId, day, reason: reason.trim().slice(0, 120) || null },
    update: { reason: reason.trim().slice(0, 120) || null },
  });
  return { ok: true };
}

export async function unblockDay(id: string): Promise<HoursResult> {
  await requireRole('OPS');
  await prisma.expertBlock.delete({ where: { id } }).catch(() => null);
  return { ok: true };
}

/** Everything the hours screen shows. Staff only — the caller has already checked. */
export async function expertCalendar() {
  const [team, hours, blocks] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['OPS', 'ADMIN'] } },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    prisma.expertHours.findMany({ orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }], take: 500 }),
    prisma.expertBlock.findMany({ where: { day: { gte: istDate(new Date()) } }, orderBy: { day: 'asc' }, take: 200 }),
  ]);
  return { team, hours, blocks };
}
