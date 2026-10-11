/**
 * Writing a project's plan (quote-to-plan.ts) to its `HomeProject`: the
 * stages with each room's checklist items, the materials, and the documents
 * signing files. Takes the database client as an argument — the signing
 * transaction (choose.ts `signFinalQuote`) and the backfill script
 * (scripts/studio/build-plans.ts) pass their own — so it has no
 * `server-only` and no import of the app's Prisma client.
 */

import type { Prisma } from '@prisma/client';
import { FILED_CONTENT_TYPE, signedQuoteDocs } from './documents';
import { quoteToPlan, type PlanMaterial, type PlanPayment, type PlanQuoteLine, type PlanStage, type SignedStageInput } from './quote-to-plan';

export type PlanDb = Pick<Prisma.TransactionClient, 'homeProjectStage' | 'homeMaterial' | 'homeDocument'>;

/** The stages, each with its items, then the materials. One create per stage (items nested), one for the materials. */
export async function writePlan(db: PlanDb, projectId: string, plan: { stages: PlanStage[]; materials: PlanMaterial[] }): Promise<void> {
  for (const s of plan.stages) {
    await db.homeProjectStage.create({
      data: {
        projectId,
        kind: s.kind,
        name: s.name,
        sortOrder: s.sortOrder,
        plannedStart: s.plannedStart,
        plannedEnd: s.plannedEnd,
        actualEnd: s.actualEnd,
        items: {
          create: s.items.map((it) => ({
            room: it.room,
            label: it.label,
            quoteLineId: it.quoteLineId,
            sortOrder: it.sortOrder,
            doneAt: it.doneAt ?? null,
          })),
        },
      },
      select: { id: true },
    });
  }
  if (plan.materials.length > 0) {
    await db.homeMaterial.createMany({
      data: plan.materials.map((m) => ({
        projectId,
        room: m.room,
        item: m.item,
        spec: m.spec,
        quoteLineId: m.quoteLineId,
        sortOrder: m.sortOrder,
      })),
    });
  }
}

/**
 * File the agreement and the signed quotation in the customer's Locker,
 * shared from the moment of signing (portal/documents.ts says what they
 * point at). `filedById` is the customer who signed; `byStudio` is false —
 * the studio did not upload them.
 */
export async function fileSignedQuote(
  db: PlanDb,
  projectId: string,
  quote: { id: string; number: string },
  filedById: string,
  at: Date,
  /** True when the studio started the project for its own client (project/own-project.ts) and so filed these. */
  byStudio = false,
): Promise<void> {
  await db.homeDocument.createMany({
    data: signedQuoteDocs(quote.id, quote.number).map((d) => ({
      projectId,
      kind: d.kind,
      title: d.title,
      storageKey: d.storageKey,
      originalName: d.originalName,
      contentType: FILED_CONTENT_TYPE,
      bytes: 0,
      uploadedById: filedById,
      byStudio,
      sharedAt: at,
      createdAt: at,
    })),
  });
}

// ── A signed project, whoever started it ───────────────────────

/** What creating a signed project writes to: the quote, the project and its plan. */
export type SignedProjectDb = PlanDb & Pick<Prisma.TransactionClient, 'studioQuote' | 'homeProject'>;

export interface SignedProjectInput {
  /** The introduction the project hangs off (One Interiors' or the studio's own client's). */
  introductionId: string;
  quote: { id: string; number: string; lines: PlanQuoteLine[] };
  startOn: Date;
  totalDays: number;
  /** The locked total, GST included. */
  contractPaise: number;
  /** The payment stages as the quote showed them. */
  stages: SignedStageInput[];
  signedAt: Date;
  /** Who filed the agreement and the quote in the Locker. */
  filedById: string;
  /** The studio filed them (its own client), not the customer signing in the app. */
  filedByStudio?: boolean;
  assuredRequestedAt?: Date | null;
}

/**
 * The one way a project is started from a quote — the customer signing in
 * the app (choose.ts `signFinalQuote`) and a studio starting its own
 * client's project (project/own-project.ts) both call this, inside their own
 * transaction: the quote is marked accepted, the project is created with
 * the total and the payment stages locked (split with `splitAcross`, so they
 * sum to the contract exactly), the plan is written and the agreement and
 * quote are filed in the Locker.
 */
export async function createSignedProject(db: SignedProjectDb, input: SignedProjectInput): Promise<{ id: string; payments: PlanPayment[] }> {
  const built = quoteToPlan({
    lines: input.quote.lines,
    startOn: input.startOn,
    totalDays: input.totalDays,
    contractPaise: input.contractPaise,
    stages: input.stages,
  });
  const payments = built.payments.map((s) => ({ label: s.label, pct: s.pct, amountPaise: s.amountPaise }));
  await db.studioQuote.update({ where: { id: input.quote.id }, data: { status: 'ACCEPTED' } });
  const created = await db.homeProject.create({
    data: {
      introductionId: input.introductionId,
      startOn: input.startOn,
      totalDays: input.totalDays,
      signedAt: input.signedAt,
      signedQuoteId: input.quote.id,
      contractPaise: BigInt(input.contractPaise),
      paymentPhases: payments,
      assuredRequestedAt: input.assuredRequestedAt ?? null,
    },
    select: { id: true },
  });
  await writePlan(db, created.id, built);
  await fileSignedQuote(db, created.id, { id: input.quote.id, number: input.quote.number }, input.filedById, input.signedAt, input.filedByStudio ?? false);
  return { id: created.id, payments };
}
