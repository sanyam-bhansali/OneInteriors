/**
 * Execution is planned, and the handover given, only once design is complete
 * (owner, 21 Nov 2026: "execution timeline should calculate and give handover
 * date only after the design phase is completed"). Called from
 * lifecycle.ts `applyPhaseEvent` when the project leaves the design phase
 * (every design step ticked, or the design signed off), inside that
 * transaction.
 *
 * Execution then runs Hauspire's execution sheet (portal/quote-to-plan.ts
 * `executionFrom`: civil 20, carpentry 67, finishing 14, handover 9 days) from
 * the day design was complete, or after the last pre-execution step still
 * open, whichever is later. Its steps are spread inside each stage, off the
 * studio's weekly off, and their "first planned" day is this one. The
 * project's days end on the new handover, and `executionPlannedAt` marks the
 * plan: until it is set no handover date is shown anywhere, and the planned
 * handover counts from it (project-rules.ts `overallDelay`).
 *
 * A project whose execution already has a tick (brought in mid-way) keeps its
 * dates: only `executionPlannedAt` is set.
 */

import type { Prisma } from '@prisma/client';
import { executionFrom, executionStepDays, planSpanDays } from '@/modules/portal/quote-to-plan';
import { STEP_TEMPLATE } from './step-template';
import { shiftStepDay } from './step-rules';
import { calendarOf, dayToDb, EVERY_DAY, istDay, onWorkingDay } from './working-days';

type Db = Prisma.TransactionClient;

/** The day execution starts: design complete today, or after the last open pre-execution step's planned day. */
export function executionStartDay(today: string, openDesignStepDays: readonly string[]): string {
  return openDesignStepDays.reduce((a, d) => (d > a ? d : a), today);
}

export async function planExecutionAfterDesign(db: Db, projectId: string, now: Date): Promise<void> {
  const p = await db.homeProject.findUnique({
    where: { id: projectId },
    select: {
      startOn: true,
      executionPlannedAt: true,
      introduction: { select: { studio: { select: { workingDays: true, holidays: { select: { day: true } } } } } },
      stages: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, kind: true, plannedStart: true, plannedEnd: true, actualEnd: true, items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, label: true, plannedOn: true, doneAt: true, inScope: true } } },
      },
    },
  });
  if (!p) return;
  const design = p.stages.find((s) => s.kind === 'DESIGN');
  const exec = p.stages.filter((s) => s.kind !== 'DESIGN');
  const started = exec.some((s) => s.actualEnd !== null || s.items.some((i) => i.doneAt !== null));
  if (!design || exec.length === 0 || started) {
    if (!p.executionPlannedAt) await db.homeProject.update({ where: { id: projectId }, data: { executionPlannedAt: now } });
    return;
  }

  const studio = p.introduction?.studio;
  const cal = studio ? calendarOf({ workingDays: studio.workingDays, holidays: studio.holidays }) : EVERY_DAY;
  const openDays = design.items.filter((i) => i.inScope && !i.doneAt && i.plannedOn).map((i) => istDay(i.plannedOn!));
  const start = onWorkingDay(executionStartDay(istDay(now), openDays), cal);
  const windows = executionFrom(start, cal);

  if (istDay(design.plannedEnd) !== start) await db.homeProjectStage.update({ where: { id: design.id }, data: { plannedEnd: dayToDb(start) } });
  for (const s of exec) {
    const w = windows.find((x) => x.kind === s.kind);
    if (!w) continue;
    await db.homeProjectStage.update({ where: { id: s.id }, data: { plannedStart: dayToDb(w.start), plannedEnd: dayToDb(w.end) } });
    const sheet = s.items.map((i) => STEP_TEMPLATE.find((t) => t.kind === s.kind && t.label.toLowerCase() === i.label.trim().toLowerCase())?.sheetDay ?? null);
    const known = s.items.map((i, k) => ({ id: i.id, d: sheet[k] })).filter((x): x is { id: string; d: string } => x.d !== null);
    const spread = executionStepDays(known.map((x) => x.d), { start: w.start, end: w.end }, cal);
    const dayOf = new Map(known.map((x, k) => [x.id, spread[k]!]));
    for (const i of s.items) {
      const d = dayOf.get(i.id) ?? shiftStepDay(i.plannedOn ? istDay(i.plannedOn) : null, { start: istDay(s.plannedStart), end: istDay(s.plannedEnd) }, w) ?? w.end;
      await db.homeChecklistItem.update({ where: { id: i.id }, data: { plannedOn: dayToDb(d), firstPlannedOn: dayToDb(d) } });
    }
  }
  const span = planSpanDays(p.startOn, [{ plannedEnd: dayToDb(windows.at(-1)!.end) }]);
  await db.homeProject.update({ where: { id: projectId }, data: { executionPlannedAt: now, ...(span ? { totalDays: span } : {}) } });
}
