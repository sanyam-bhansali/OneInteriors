/**
 * Giving existing projects Hauspire's steps (the step tracker, owner
 * 11 Oct 2026; docs/studio-workspace/STEP-TRACKER.md). Run by the owner
 * through scripts/studio/steps-from-template.ts after the migration
 * 20261011170000_step_tracker; the logic is here, with the client passed in,
 * so tests/steps-backfill.test.ts can run it against a fake database.
 *
 * For each project that has a plan whose items are still the ones generated
 * from its quote (no item carries a weight yet):
 *
 * - every item of each plan stage is replaced by the template's steps for
 *   the stage's kind, with their default weights and planned days spread
 *   across the stage's CURRENT window (so a stage that moved keeps its
 *   steps inside its new dates);
 * - a stage already done gets its steps ticked on its `actualEnd`, with
 *   `doneSource` BACKFILL and no photo — the customer's percentage matches
 *   the stages they already saw done;
 * - stage rows, dates, moves, site logs and materials are not touched.
 *
 * What is lost: an old item ticked in a site post pointed at that post
 * (`doneSiteLogId`), so the post's "Done: …" line in the customer's feed
 * had it; the item goes, so the line goes. The photos and their sentences
 * stay. The dry run counts them (`tickedFromPosts`).
 *
 * Idempotent: a project with any weighted item is skipped, and the check is
 * repeated inside each project's transaction. Dry run unless `apply`.
 */

import type { PrismaClient } from '@prisma/client';
import { PLAN_KINDS, type PlanKind } from './tracker';
import { stepsFor } from './quote-to-plan';

export type StepsBackfillDb = Pick<PrismaClient, 'homeProject' | '$transaction'>;

export interface StepsBackfillLine {
  projectId: string;
  /** Items there now (generated from the quote). */
  oldItems: number;
  /** Of them, ticked in a site post: their "Done" line leaves that post. */
  tickedFromPosts: number;
  /** Steps it gets. */
  steps: number;
  /** Of them, ticked because their stage was already done. */
  tickedSteps: number;
  written: boolean;
}

const isKind = (k: string): k is PlanKind => (PLAN_KINDS as readonly string[]).includes(k);

export async function stepsFromTemplate(db: StepsBackfillDb, opts: { apply: boolean }): Promise<StepsBackfillLine[]> {
  const projects = await db.homeProject.findMany({
    where: { stages: { some: {} } },
    orderBy: { startOn: 'asc' },
    select: {
      id: true,
      stages: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, kind: true, plannedStart: true, plannedEnd: true, actualEnd: true, items: { select: { id: true, weightBp: true, doneAt: true, doneSiteLogId: true } } },
      },
    },
  });
  const out: StepsBackfillLine[] = [];

  for (const p of projects) {
    const items = p.stages.flatMap((s) => s.items);
    if (items.some((i) => i.weightBp > 0)) continue; // already on steps
    const plan = p.stages
      .filter((s) => isKind(s.kind))
      .map((s) => ({
        stageId: s.id,
        steps: stepsFor(s.kind as PlanKind, s.plannedStart, s.plannedEnd).map((st) => ({
          ...st,
          doneAt: s.actualEnd,
          doneSource: s.actualEnd ? ('BACKFILL' as const) : null,
        })),
      }));
    const line: StepsBackfillLine = {
      projectId: p.id,
      oldItems: items.length,
      tickedFromPosts: items.filter((i) => i.doneSiteLogId !== null).length,
      steps: plan.reduce((n, s) => n + s.steps.length, 0),
      tickedSteps: plan.reduce((n, s) => n + s.steps.filter((x) => x.doneAt).length, 0),
      written: false,
    };

    if (opts.apply) {
      line.written = await db.$transaction(async (tx) => {
        // Again inside the transaction: another run may have got here first.
        if ((await tx.homeChecklistItem.count({ where: { stage: { projectId: p.id }, weightBp: { gt: 0 } } })) > 0) return false;
        await tx.homeChecklistItem.deleteMany({ where: { stage: { projectId: p.id } } });
        for (const s of plan) {
          await tx.homeChecklistItem.createMany({
            data: s.steps.map((st) => ({
              stageId: s.stageId,
              room: st.room,
              label: st.label,
              sortOrder: st.sortOrder,
              weightBp: st.weightBp,
              inScope: true,
              plannedOn: st.plannedOn,
              doneAt: st.doneAt,
              doneSource: st.doneSource,
            })),
          });
        }
        return true;
      });
    }
    out.push(line);
  }
  return out;
}
