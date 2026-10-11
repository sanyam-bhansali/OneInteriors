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
import type { PlanMaterial, PlanStage } from './quote-to-plan';

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
      byStudio: false,
      sharedAt: at,
      createdAt: at,
    })),
  });
}
