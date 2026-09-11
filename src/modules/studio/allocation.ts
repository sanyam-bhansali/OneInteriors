import 'server-only';

/**
 * Allocation — how often a studio is shown, never where it appears.
 *
 * ## The rule this file exists to keep
 *
 * A subscription buys **volume**: how many briefs a studio is put in front of.
 * It never buys **position**: order within one customer's matches comes from
 * the matching engine and nothing else.
 *
 * That distinction is the whole product. Pay-to-rank dressed as "recommended"
 * is the exact mechanic behind the complaints we are positioning against, it is
 * provable from the outside by any competitor or journalist, and it would make
 * the verification tiers worthless the day it came out.
 *
 * So this module can pause a studio and record what it can take on, and it has
 * no function that moves a studio up. `score.ts` reads exactly one field from
 * here — `pausedAt` — and that field can only ever remove a studio from a
 * customer's results, never promote one.
 *
 * If someone later asks for a "boost" control, the honest answer is that the
 * thing they actually want is a higher volume cap, which is this file, or a
 * better-fitting studio, which is the matching engine.
 */

import { prisma } from '@/lib/prisma';
import { Prisma, type PauseCause } from '@prisma/client';
import { requireRole } from '@/modules/auth/session';
import { revalidateRoster } from './roster-cache';

export type AllocationResult = { ok: true } | { ok: false; error: string };

/**
 * ## On "set priority so a studio gets clients first"
 *
 * There are two different things that phrase can mean, and only one of them is
 * safe to build.
 *
 * **Ordering** — moving a studio up inside one customer's results. Not built,
 * and there is no field here that could express it. The moment that exists, the
 * order stops meaning "best fit for you" and starts meaning "whoever we owe
 * something to", which is exactly the mechanic behind the complaints this
 * product is positioned against.
 *
 * **Selection** — which studios get into the shortlist at all, when more
 * qualify than we show. This is legitimate and it is what `autoPauseSweep` and
 * the guarantee ledger act on. A studio behind on its guaranteed briefs is owed
 * volume; a brand-new studio needs a first project to ever earn a delivery
 * record. Both are solved by showing them to MORE customers, not by moving them
 * up in front of one.
 *
 * So the honest control for "focus on this studio" is: raise how often they are
 * shown, and pause the studios who are full. Both are here. Neither can reorder
 * anybody's results, and `tests/allocation-governance.test.ts` asserts that the
 * ranking code cannot even read these fields.
 */

/**
 * Take a studio out of rotation.
 *
 * The reason is required and is not decoration: a studio that discovers it has
 * gone invisible without being told is a studio that leaves, and the reason is
 * what ops reads six weeks later when nobody remembers why. It is written to
 * the audit log for the same reason.
 */
export async function pauseStudio(
  studioId: string,
  reason: string,
  cause: PauseCause = 'MANUAL',
): Promise<AllocationResult> {
  const actor = await requireRole('OPS');
  const trimmed = reason.trim();

  if (trimmed.length < 8) {
    return { ok: false, error: 'Say why. Future you will not remember, and the studio will ask.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.studio.findUniqueOrThrow({
        where: { id: studioId },
        select: { pausedAt: true, pausedReason: true, tradeName: true },
      });

      await tx.studio.update({
        where: { id: studioId },
        data: { pausedAt: new Date(), pausedReason: trimmed, pauseCause: cause },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'studio.pause',
          entityType: 'Studio',
          entityId: studioId,
          before: { pausedAt: before.pausedAt?.toISOString() ?? null } as Prisma.InputJsonValue,
          after: { pausedAt: new Date().toISOString(), reason: trimmed } as Prisma.InputJsonValue,
        },
      });
    });

    // They vanish from customer results on the next request, not in a minute.
    await revalidateRoster();
    return { ok: true };
  } catch (error) {
    console.error('[allocation] pause failed', error);
    return { ok: false, error: 'Could not pause that studio.' };
  }
}

/** Put a studio back into rotation. */
export async function resumeStudio(studioId: string): Promise<AllocationResult> {
  const actor = await requireRole('OPS');

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.studio.findUniqueOrThrow({
        where: { id: studioId },
        select: { pausedAt: true, pausedReason: true },
      });

      await tx.studio.update({
        where: { id: studioId },
        data: { pausedAt: null, pausedReason: null, pauseCause: null },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'studio.resume',
          entityType: 'Studio',
          entityId: studioId,
          before: {
            pausedAt: before.pausedAt?.toISOString() ?? null,
            reason: before.pausedReason,
          } as Prisma.InputJsonValue,
          after: { pausedAt: null } as Prisma.InputJsonValue,
        },
      });
    });

    await revalidateRoster();
    return { ok: true };
  } catch (error) {
    console.error('[allocation] resume failed', error);
    return { ok: false, error: 'Could not resume that studio.' };
  }
}

/**
 * Record how many projects a month a studio says it can take.
 *
 * Self-declared, and treated as such. It is planning information for ops — it
 * tells us whether the roster can absorb the demand we are buying — and it is
 * deliberately not an input to matching. A studio claiming a big number does
 * not get shown more; it just stops us over-selling a roster that cannot
 * deliver.
 */
export async function setCapacity(
  studioId: string,
  capacityPerMonth: number | null,
): Promise<AllocationResult> {
  await requireRole('OPS');

  if (capacityPerMonth !== null && (!Number.isInteger(capacityPerMonth) || capacityPerMonth < 0)) {
    return { ok: false, error: 'Capacity has to be a whole number of projects, or blank.' };
  }
  if (capacityPerMonth !== null && capacityPerMonth > 60) {
    return { ok: false, error: 'That is more than two projects a working day. Check the figure.' };
  }

  try {
    await prisma.studio.update({ where: { id: studioId }, data: { capacityPerMonth } });
    return { ok: true };
  } catch (error) {
    console.error('[allocation] capacity failed', error);
    return { ok: false, error: 'Could not save that.' };
  }
}

export interface SweepResult {
  pausedAtCapacity: string[];
  pausedUnpaid: string[];
  resumed: string[];
}

/**
 * Pause the studios who should be out, resume the ones who should be back.
 *
 * ## Why this is a sweep and not a check at match time
 *
 * Deciding "is this studio full?" inside the matching path would mean counting
 * a month of projects for every studio on every brief — and it would make the
 * results depend on when a page was loaded. Running it as a sweep means the
 * roster has one state, it is visible in the ops console, and a studio can be
 * told why they went quiet.
 *
 * ## The two automatic pauses
 *
 * **At capacity.** A studio that said it can take five projects a month and has
 * won five should stop receiving briefs. Sending them a sixth customer produces
 * either a decline — which costs that customer their introduction — or an
 * accepted project the studio cannot staff, which is worse.
 *
 * **Unpaid.** A subscription that has gone PAST_DUE stops buying volume. This
 * is the blunter of the two and it is deliberately reversible the moment the
 * invoice clears, because a studio that pays on Tuesday and is still invisible
 * on Friday will not pay again.
 *
 * ## The resume rule, which matters more than the pauses
 *
 * Only pauses this function created are lifted by it. A MANUAL pause — someone
 * suspended a studio over a dispute — is never undone automatically, whatever
 * the month or the invoice does. Getting that backwards would quietly put a
 * studio under investigation back in front of customers.
 */
export async function autoPauseSweep(): Promise<SweepResult> {
  await requireRole('OPS');

  const result: SweepResult = { pausedAtCapacity: [], pausedUnpaid: [], resumed: [] };

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const studios = await prisma.studio.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      tradeName: true,
      capacityPerMonth: true,
      pausedAt: true,
      pauseCause: true,
      subscription: { select: { status: true } },
      _count: { select: { projects: { where: { createdAt: { gte: monthStart } } } } },
    },
  });

  for (const s of studios) {
    const wonThisMonth = s._count.projects;
    const full = s.capacityPerMonth !== null && wonThisMonth >= s.capacityPerMonth;
    const unpaid = s.subscription?.status === 'PAST_DUE';

    if (!s.pausedAt) {
      // Unpaid first: it is the more serious of the two, and it should be the
      // reason recorded if both happen to be true.
      if (unpaid) {
        await pauseStudio(
          s.id,
          'Subscription payment is past due. This lifts as soon as the invoice clears.',
          'PAYMENT_DUE',
        );
        result.pausedUnpaid.push(s.tradeName);
      } else if (full) {
        await pauseStudio(
          s.id,
          `At the ${s.capacityPerMonth} projects a month you told us you can take. Back automatically next month.`,
          'AT_CAPACITY',
        );
        result.pausedAtCapacity.push(s.tradeName);
      }
      continue;
    }

    // Already paused — lift it only if WE caused it and the cause has gone.
    const liftCapacity = s.pauseCause === 'AT_CAPACITY' && !full;
    const liftPayment = s.pauseCause === 'PAYMENT_DUE' && !unpaid;

    if (liftCapacity || liftPayment) {
      await resumeStudio(s.id);
      result.resumed.push(s.tradeName);
    }
  }

  return result;
}

export interface RosterCapacity {
  /** Studios live and not paused. */
  live: number;
  paused: number;
  /** Sum of declared capacity across live studios. Null where undeclared. */
  declaredCapacity: number;
  /** How many live studios have not told us their capacity. */
  unknownCapacity: number;
}

/**
 * Can the roster absorb what we are about to buy?
 *
 * The question ops actually needs answered before spending on leads: if every
 * live studio filled its declared capacity, how many projects a month could the
 * city take? Buying demand past that point produces customers we cannot place,
 * which is a worse failure than buying too few — an unplaceable customer is a
 * bad review and a studio we over-promised.
 */
export async function rosterCapacity(city = 'pune'): Promise<RosterCapacity> {
  await requireRole('OPS');

  const studios = await prisma.studio.findMany({
    where: { city, status: 'ACTIVE' },
    select: { pausedAt: true, capacityPerMonth: true },
  });

  const live = studios.filter((s) => s.pausedAt === null);

  return {
    live: live.length,
    paused: studios.length - live.length,
    declaredCapacity: live.reduce((sum, s) => sum + (s.capacityPerMonth ?? 0), 0),
    unknownCapacity: live.filter((s) => s.capacityPerMonth === null).length,
  };
}
