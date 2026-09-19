import 'server-only';

/**
 * Keeping what the customer actually did.
 *
 * ## The hole this fills
 *
 * The brief has always been in Postgres. What the brief *led to* was not:
 * the generated quotes, which studios went side by side, and which lines the
 * customer cared enough to star all lived in `sessionStorage` and died when
 * the tab closed. So the product could answer "how many people reached the
 * compare screen" and could never answer "what did the quotes that won have
 * in common" — which is the only question that eventually matters.
 *
 * Note what is being recovered here. The starred lines are a better statement
 * of intent than anything in the quiz: not what somebody said they wanted
 * before they saw a price, but which work they checked the price of twice.
 *
 * ## No model learns from this
 *
 * Deliberately. `docs/ARCHITECTURE.md` holds the line at no ML in matching
 * under 500 completed projects, and on 68 briefs a model would learn noise —
 * which in a ranking product becomes self-fulfilling, because the studio that
 * ranks high gets more leads, generates more data, and ranks higher. This
 * module accumulates; a person reads it and decides. That is the whole
 * intended pipeline, and the export in `ops/data` is its other end.
 *
 * ## Degradation, and why it is absolute
 *
 * Every function here swallows its own failures. `sessionStorage` remains the
 * fast path and the source of truth for what is on screen; this is a second,
 * durable copy written behind it. With the database unreachable the quiz, the
 * quote and the comparison keep working exactly as they did — which is the
 * same bargain `brief/repository.ts` already makes, and the reason recording
 * can be added to a live journey without risking it.
 *
 * **A failure to record must never cost somebody their quote.**
 */

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/modules/auth/session';
import { readAnonKey } from '@/modules/brief/repository';
import { RATES_VERSION } from '@/data/filed-rates';
import type { FirstQuote as BuiltQuote } from './first-quote';
import type { FloorPlan } from './project-store';

/** Prisma's enum, spelled out rather than imported, so this file stays readable. */
type RunSourceValue = 'FLOOR_PLAN' | 'CUSTOMER' | 'STANDARD';

const RUN_SOURCE: Record<FloorPlan['source'], RunSourceValue> = {
  floor_plan: 'FLOOR_PLAN',
  customer: 'CUSTOMER',
  standard: 'STANDARD',
};

/**
 * Which brief this is, by account or by cookie.
 *
 * The same resolution `brief/repository.ts` uses, and it has to be: a quote
 * generated before sign-in belongs to the same journey as one generated
 * after, and hanging them off different owners would split one customer into
 * two rows that never meet again.
 */
async function currentBriefId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (user) {
      const row = await prisma.brief.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (row) return row.id;
    }
    const anonKey = await readAnonKey();
    if (!anonKey) return null;
    const row = await prisma.brief.findUnique({ where: { anonKey }, select: { id: true } });
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Record a quote that was just built.
 *
 * Replaces rather than appends. A customer has one quote per studio at any
 * moment, and keeping supersedes would make every later query begin by asking
 * which of them the person actually saw.
 *
 * The lines are kept in full rather than rolled up to a room subtotal. A total
 * with no lines under it is exactly what the landing page holds up as the
 * thing wrong with every other quote in this market; storing it that way here
 * would make our own record worse than the document we showed.
 */
export async function recordFirstQuote(input: {
  studioSlug: string;
  quote: BuiltQuote;
  plan: FloorPlan;
}): Promise<void> {
  try {
    const briefId = await currentBriefId();
    if (!briefId) return;

    const studio = await prisma.studio.findUnique({
      where: { slug: input.studioSlug },
      select: { id: true },
    });
    if (!studio) return;

    const q = input.quote;

    await prisma.$transaction(async (tx) => {
      const row = await tx.firstQuote.upsert({
        where: { briefId_studioId: { briefId, studioId: studio.id } },
        create: {
          briefId,
          studioId: studio.id,
          modularPaise: BigInt(q.modularPaise),
          nonModularPaise: BigInt(q.nonModularPaise),
          modularDiscountPaise: BigInt(q.modularDiscountPaise),
          professionalFeePaise: BigInt(q.professionalFeePaise),
          gstPaise: BigInt(q.gstPaise),
          totalPaise: BigInt(q.totalPaise),
          lowPaise: BigInt(q.lowPaise),
          highPaise: BigInt(q.highPaise),
          variancePct: q.variancePct,
          kitchenRunMm: input.plan.kitchenRunMm,
          runSource: RUN_SOURCE[input.plan.source],
          notPriced: q.notPriced,
          ratesVersion: RATES_VERSION,
        },
        update: {
          modularPaise: BigInt(q.modularPaise),
          nonModularPaise: BigInt(q.nonModularPaise),
          modularDiscountPaise: BigInt(q.modularDiscountPaise),
          professionalFeePaise: BigInt(q.professionalFeePaise),
          gstPaise: BigInt(q.gstPaise),
          totalPaise: BigInt(q.totalPaise),
          lowPaise: BigInt(q.lowPaise),
          highPaise: BigInt(q.highPaise),
          variancePct: q.variancePct,
          kitchenRunMm: input.plan.kitchenRunMm,
          runSource: RUN_SOURCE[input.plan.source],
          notPriced: q.notPriced,
          ratesVersion: RATES_VERSION,
        },
        select: { id: true },
      });

      // Replace wholesale. A regenerated quote can have fewer lines than the
      // one before it — a studio whose rate card lost an item — and merging
      // would leave the dropped line sitting there as a price we never gave.
      await tx.firstQuoteLine.deleteMany({ where: { quoteId: row.id } });
      await tx.firstQuoteLine.createMany({
        data: q.lines.map((line) => ({
          quoteId: row.id,
          code: line.code,
          room: line.room,
          label: line.label,
          work: line.work,
          size: line.size,
          quantity: line.quantity,
          unit: line.unit,
          ratePaise: BigInt(line.ratePaise),
          amountPaise: BigInt(line.amountPaise),
          spec: line.spec,
          standard: line.standard,
        })),
      });
    });
  } catch {
    // Never into the UI. See the header.
  }
}

/**
 * Record what went side by side, and which lines mattered.
 *
 * One row per brief, updated in place. Starring and comparing are revisions
 * of a single opinion, not a log of separate acts — somebody who stars a line
 * and then unstars it has not told us two things.
 */
export async function recordDecision(input: {
  comparedSlugs: string[];
  starredCodes: string[];
}): Promise<void> {
  try {
    const briefId = await currentBriefId();
    if (!briefId) return;

    await prisma.quoteDecision.upsert({
      where: { briefId },
      create: {
        briefId,
        comparedSlugs: input.comparedSlugs,
        starredCodes: input.starredCodes,
      },
      update: {
        comparedSlugs: input.comparedSlugs,
        starredCodes: input.starredCodes,
      },
    });
  } catch {
    // Never into the UI.
  }
}

/**
 * Record who won.
 *
 * The column everything else here exists to eventually fill. Quotes without
 * outcomes are homework nobody marks: you can describe what was priced and
 * never learn what worked.
 *
 * `source` is required because an outcome with no provenance is a rumour, and
 * six months from now the difference between "ops watched this close" and
 * "the customer mentioned it" will matter to anyone reading the table.
 *
 * Absence stays absence. Nothing here ever writes a loss by inference — most
 * briefs simply never reach a decision, and treating silence as a loss would
 * bias every figure ever calculated from this table.
 */
export async function recordOutcome(input: {
  briefId: string;
  wonByStudioId: string;
  source: 'OPS_RECORDED' | 'STUDIO_CRM' | 'CUSTOMER_REPORTED';
  decidedAt?: Date;
}): Promise<void> {
  try {
    await prisma.quoteDecision.upsert({
      where: { briefId: input.briefId },
      create: {
        briefId: input.briefId,
        wonByStudioId: input.wonByStudioId,
        outcomeSource: input.source,
        decidedAt: input.decidedAt ?? new Date(),
      },
      update: {
        wonByStudioId: input.wonByStudioId,
        outcomeSource: input.source,
        decidedAt: input.decidedAt ?? new Date(),
      },
    });
  } catch {
    // Never into the UI.
  }
}
