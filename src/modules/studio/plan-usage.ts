import 'server-only';

/**
 * The Free plan's limits, counted and checked where the thing is made (owner,
 * 24 Nov 2026; software-plan.ts holds the numbers, `fits` the rule).
 *
 * - **Open leads**: checked before a lead is added by hand or imported. Leads
 *   that arrive by themselves (the enquiry form, lead intake) always land: a
 *   customer's enquiry is never lost to a plan limit.
 * - **New quotations printed a month**: checked when a quotation's print page
 *   (the PDF) opens for the first time; a quotation printed before prints
 *   again as often as they like (`StudioQuote.firstPrintedAt`).
 * - **File storage**: checked before a lead file's upload ticket is given.
 *
 * Every check reads the studio's plan fresh, so ops moving a studio to Pro
 * lifts the limit on the next click. Nothing here deletes anything.
 */

import { prisma } from '@/lib/prisma';
import { LIVE } from '@/modules/studio-practice/demo-lead';
import { fits, istMonthStart, limitMessage, limitsFor, type PlanLimits } from './software-plan';

export type Room = { ok: true } | { ok: false; error: string };

const OK: Room = { ok: true };

async function limitsOf(studioId: string): Promise<PlanLimits> {
  const row = await prisma.studio.findUnique({ where: { id: studioId }, select: { softwarePlan: true, fullSoftware: true } });
  return limitsFor(row);
}

/** Leads still in play: not won, done or lost, not in the Bin, not the sample. */
export async function openLeadCount(studioId: string): Promise<number> {
  return prisma.studioClient.count({ where: { studioId, ...LIVE, stage: { kind: 'OPEN' } } });
}

/** Whether `adding` more leads fit, for a lead added by hand or an import. */
export async function leadRoom(studioId: string, adding = 1): Promise<Room> {
  const limits = await limitsOf(studioId);
  if (limits.activeLeads === null) return OK;
  return fits(limits.activeLeads, await openLeadCount(studioId), adding) ? OK : { ok: false, error: limitMessage('activeLeads', limits) };
}

/** Whether a lead file of `bytes` fits in the studio's storage. */
export async function storageRoom(studioId: string, bytes: number): Promise<Room> {
  const limits = await limitsOf(studioId);
  if (limits.storageBytes === null) return OK;
  const used = await prisma.studioClientFile.aggregate({ where: { studioId }, _sum: { bytes: true } });
  return fits(limits.storageBytes, used._sum.bytes ?? 0, bytes) ? OK : { ok: false, error: limitMessage('storageBytes', limits) };
}

/**
 * The print page opening: a quotation printed before always prints; a new one
 * counts against Free's month, and is marked printed when it fits. The mark is
 * written only where it is still empty, so it is set once and never moved.
 */
export async function claimPrint(quoteId: string, studioId: string, now = new Date()): Promise<Room> {
  const quote = await prisma.studioQuote.findFirst({ where: { id: quoteId, studioId }, select: { firstPrintedAt: true } });
  if (!quote) return OK;
  if (quote.firstPrintedAt) return OK;
  const limits = await limitsOf(studioId);
  if (limits.quotePrintsPerMonth !== null) {
    const used = await prisma.studioQuote.count({ where: { studioId, firstPrintedAt: { gte: istMonthStart(now) } } });
    if (!fits(limits.quotePrintsPerMonth, used)) return { ok: false, error: limitMessage('quotePrintsPerMonth', limits) };
  }
  await prisma.studioQuote.updateMany({ where: { id: quoteId, studioId, firstPrintedAt: null }, data: { firstPrintedAt: now } });
  return OK;
}
