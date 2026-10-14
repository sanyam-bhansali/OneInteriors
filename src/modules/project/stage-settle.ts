/**
 * Finishing and reopening a stage from its steps' ticks (studio workspace
 * Phase 3, the step tracker): shared by the office (plan-edit.ts) and the
 * site post (site-log.ts), each calling it inside its own transaction. It
 * takes the client as an argument, so it has no `server-only` and no import
 * of the app's Prisma client. Rules in project-rules.ts `settleStage`.
 *
 * - A stage is done when every IN-SCOPE step is ticked; not-in-scope steps
 *   are ignored (docs/studio-workspace/STEP-TRACKER.md rule 7).
 * - Its photo gate (a stage shows done only with a site photo from it) is
 *   met by its steps' own photos: every tick carries one. Photos posted
 *   while it was the current stage, and older updates' photos tagged with
 *   its kind, count too, for projects from before the step tracker.
 * - Unticking (a correction) reopens it.
 */

import type { Prisma } from '@prisma/client';
import { KIND_TRACKER_KEYS, PLAN_KINDS, type PlanKind } from '@/modules/portal/tracker';
import { recordEvent, type ProjectActor } from './events';
import { syncProvisionalHandover } from './lifecycle';
import { settleStage } from './project-rules';
import { shiftDesignStepDay, shiftStepDay } from './step-rules';
import { dayFromDb, dayToDb } from './working-days';

type Db = Prisma.TransactionClient;

const isKind = (k: string): k is PlanKind => (PLAN_KINDS as readonly string[]).includes(k);

/** The steps that count for a stage being done: the in-scope ones (older rows read as in scope). */
export const countedSteps = <T extends { inScope?: boolean | null }>(items: readonly T[]): T[] => items.filter((i) => i.inScope !== false);

/**
 * Site photos for each stage: photos on a site log whose stage it is
 * (Phase 2), photos older free-text updates tagged with one of the stage
 * kind's tracker keys, and the photos its own steps were ticked with.
 *
 * Design (Studio OS Phase 2): design steps are ticked on the Design tab,
 * not with a site photo, each one a deliberate act by the designer or the
 * PM, some with their file. So for the DESIGN stage every ticked step counts
 * as its evidence (a backfilled tick does not).
 */
export async function photosByStage(
  db: Db,
  projectId: string,
  stages: readonly { id: string; kind: string; items?: readonly { donePhotoId?: string | null; doneAt?: Date | null; doneSource?: string | null }[] }[],
): Promise<Map<string, number>> {
  const ids = stages.map((s) => s.id);
  const [logs, updates] = await Promise.all([
    db.homeSiteLog.findMany({
      where: { projectId, stageId: { in: ids } },
      // A step's photo is counted with its step below, wherever it was posted, so not here too.
      select: { stageId: true, _count: { select: { photos: { where: { doneStep: { is: null } } } } } },
    }),
    db.homeProjectUpdate.findMany({
      where: { projectId, stage: { not: null }, NOT: { photoPaths: { isEmpty: true } } },
      select: { stage: true, photoPaths: true },
    }),
  ]);
  const out = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const l of logs) if (l.stageId) out.set(l.stageId, (out.get(l.stageId) ?? 0) + l._count.photos);
  for (const s of stages) {
    const own = (s.items ?? []).filter((i) => i.donePhotoId || (s.kind === 'DESIGN' && i.doneAt && i.doneSource !== 'BACKFILL')).length;
    if (own) out.set(s.id, (out.get(s.id) ?? 0) + own);
    if (!isKind(s.kind)) continue;
    const keys = KIND_TRACKER_KEYS[s.kind] as readonly string[];
    const legacy = updates.filter((u) => u.stage !== null && keys.includes(u.stage)).reduce((n, u) => n + u.photoPaths.length, 0);
    out.set(s.id, (out.get(s.id) ?? 0) + legacy);
  }
  return out;
}

/** The old `doneStages` keys for a kind, kept in step while the app still reads them (tracker-store.ts `writeStageDone`). */
export async function syncDoneStages(db: Db, projectId: string, kind: PlanKind, done: boolean): Promise<void> {
  const p = await db.homeProject.findUnique({ where: { id: projectId }, select: { doneStages: true } });
  if (!p) return;
  const keys = KIND_TRACKER_KEYS[kind] as readonly string[];
  const next = done ? [...new Set([...p.doneStages, ...keys])] : p.doneStages.filter((k) => !keys.includes(k));
  if (next.length !== p.doneStages.length || next.some((k, i) => k !== p.doneStages[i])) {
    await db.homeProject.update({ where: { id: projectId }, data: { doneStages: next } });
  }
}

/** Marks a stage done (or reopens it), keeps `doneStages` in step and records the event. */
export async function writeDone(db: Db, projectId: string, stage: { id: string; kind: string }, done: boolean, actor: ProjectActor, now: Date): Promise<void> {
  await db.homeProjectStage.update({ where: { id: stage.id }, data: { actualEnd: done ? now : null } });
  if (isKind(stage.kind)) await syncDoneStages(db, projectId, stage.kind, done);
  await recordEvent(db, { projectId, type: done ? 'stage.done' : 'stage.reopened', actor, refId: stage.id, at: now });
}

/**
 * A stage's dates moved (a moved date, or a late decision's automatic move):
 * its OPEN steps' planned days move with it (step-rules.ts `shiftStepDay`); a
 * ticked step keeps the day it was planned for. The DESIGN stage's steps are
 * linked and move only with its start (`shiftDesignStepDay`, Studio OS
 * Phase 2), so stretching design to catch up with a late step does not move
 * them again. Days are 'YYYY-MM-DD'. Call inside the transaction that moves
 * the stage.
 */
export async function shiftStepsWithStage(
  db: Db,
  stageId: string,
  before: { start: string; end: string },
  after: { start: string; end: string },
): Promise<void> {
  if (before.start === after.start && before.end === after.end) return;
  const steps = await db.homeChecklistItem.findMany({
    where: { stageId, plannedOn: { not: null }, doneAt: null },
    select: { id: true, plannedOn: true, stage: { select: { kind: true } } },
  });
  for (const st of steps) {
    const from = dayFromDb(st.plannedOn!);
    const to = (st.stage?.kind === 'DESIGN' ? shiftDesignStepDay : shiftStepDay)(from, before, after);
    if (to && to !== from) await db.homeChecklistItem.update({ where: { id: st.id }, data: { plannedOn: dayToDb(to) } });
  }
}

/**
 * After ticks change: finish the stage when its last in-scope step is
 * ticked and it has a photo, reopen it when one is unticked. Call inside
 * the same transaction as the ticks. Returns what changed.
 */
export async function settleStageAfterTicks(db: Db, projectId: string, stageId: string, actor: ProjectActor, now = new Date()): Promise<'mark-done' | 'reopen' | 'keep'> {
  const stage = await db.homeProjectStage.findFirst({
    where: { id: stageId, projectId },
    select: { id: true, kind: true, actualEnd: true, items: { select: { doneAt: true, inScope: true, donePhotoId: true, doneSource: true } } },
  });
  if (!stage) return 'keep';
  const photos = (await photosByStage(db, projectId, [stage])).get(stage.id) ?? 0;
  const items = countedSteps(stage.items).map((i) => ({ done: i.doneAt !== null }));
  const outcome = settleStage({ items, photos, done: stage.actualEnd !== null });
  if (outcome !== 'keep') await writeDone(db, projectId, stage, outcome === 'mark-done', actor, now);
  // The project lifecycle: the provisional handover step moves the project to the closure (and back, on an untick).
  if (stage.kind === 'HANDOVER') await syncProvisionalHandover(db, projectId, stage.id, actor, now);
  return outcome;
}
