/**
 * Giving a plan to projects signed before quote-to-plan existed (studio
 * workspace Phase 1). Run by the owner through scripts/studio/build-plans.ts;
 * the logic is here, with the client passed in, so tests/plan-backfill.test.ts
 * can run it against a fake database.
 *
 * For each `HomeProject` with no `HomeProjectStage` rows:
 *
 * - **Signed in the app** (`signedQuoteId` and the quote still there): the
 *   plan from the signed quote, exactly as signing builds it now —
 *   stages with their steps, the materials from its lines — and the agreement and signed
 *   quotation filed in the Locker if they are not already. The payment plan
 *   is left alone: it was copied at signing (`paymentPhases`).
 * - **Started by ops by hand** (no signed quote): the five stages with their
 *   template steps.
 *
 * Either way, stages the old tracker had ticked (`doneStages`) come across
 * as done (quote-to-plan.ts `carryDone`), so the customer's tracker shows the
 * same progress the moment it switches to the plan.
 *
 * Idempotent: a project that has any stage row is skipped, and the check is
 * repeated inside each project's transaction, so running it twice, or
 * twice at once, writes each plan once. Dry run unless `apply`.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { fromDb } from '@/lib/money';
import { readSignedStages } from './payments';
import { carryDone, quoteToPlan, trackerToPlan, type PlanMaterial, type PlanStage } from './quote-to-plan';
import { fileSignedQuote, writePlan } from './plan-write';
import { SIGNED_QUOTE_PREFIX } from './documents';

export type BackfillDb = Pick<PrismaClient, 'homeProject' | 'studioQuote' | '$transaction'>;

export interface BackfillLine {
  projectId: string;
  source: 'quote' | 'tracker';
  stages: number;
  items: number;
  materials: number;
  doneStages: number;
  filesDocuments: boolean;
  written: boolean;
}

const PROJECT_SELECT = {
  id: true,
  startOn: true,
  totalDays: true,
  doneStages: true,
  signedAt: true,
  signedQuoteId: true,
  contractPaise: true,
  paymentPhases: true,
  introduction: { select: { brief: { select: { userId: true } } } },
  documents: { where: { storageKey: { startsWith: SIGNED_QUOTE_PREFIX } }, select: { id: true } },
} satisfies Prisma.HomeProjectSelect;

export async function backfillPlans(db: BackfillDb, opts: { apply: boolean; now?: Date }): Promise<BackfillLine[]> {
  const now = opts.now ?? new Date();
  const projects = await db.homeProject.findMany({ where: { stages: { none: {} } }, orderBy: { startOn: 'asc' }, select: PROJECT_SELECT });
  const out: BackfillLine[] = [];

  for (const p of projects) {
    const quote = p.signedQuoteId
      ? await db.studioQuote.findUnique({
          where: { id: p.signedQuoteId },
          select: {
            id: true,
            number: true,
            lines: { orderBy: { sortOrder: 'asc' }, select: { id: true, room: true, product: true, details: true, code: true } },
          },
        })
      : null;

    let stages: PlanStage[];
    let materials: PlanMaterial[] = [];
    if (quote) {
      const built = quoteToPlan({
        lines: quote.lines,
        startOn: p.startOn,
        totalDays: p.totalDays,
        contractPaise: p.contractPaise === null ? 0 : fromDb(p.contractPaise),
        stages: readSignedStages(p.paymentPhases) ?? [],
      });
      stages = carryDone(built.stages, p.doneStages, now);
      materials = built.materials;
    } else {
      stages = trackerToPlan(p, now);
    }

    const customerId = p.introduction.brief.userId;
    const filesDocuments = Boolean(quote && customerId && p.documents.length === 0);
    const line: BackfillLine = {
      projectId: p.id,
      source: quote ? 'quote' : 'tracker',
      stages: stages.length,
      items: stages.reduce((n, s) => n + s.items.length, 0),
      materials: materials.length,
      doneStages: stages.filter((s) => s.actualEnd !== null).length,
      filesDocuments,
      written: false,
    };

    if (opts.apply) {
      line.written = await db.$transaction(async (tx) => {
        // Again inside the transaction: another run may have got here first.
        if ((await tx.homeProjectStage.count({ where: { projectId: p.id } })) > 0) return false;
        await writePlan(tx, p.id, { stages, materials });
        if (filesDocuments && quote && customerId) await fileSignedQuote(tx, p.id, quote, customerId, p.signedAt ?? now);
        return true;
      });
    }
    out.push(line);
  }
  return out;
}
