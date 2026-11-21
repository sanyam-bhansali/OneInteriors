/**
 * Execution is planned, and the handover given, only once design is complete
 * (owner, 21 Nov 2026: "execution timeline should calculate and give handover
 * date only after the design phase is completed"). Called from
 * lifecycle.ts `applyPhaseEvent` when the project leaves the design phase
 * (every design step ticked, or the design signed off), inside that
 * transaction.
 *
 * Execution then runs for the flat's size and category (step-template.ts
 * `executionDaysFor`), split and stepped as Hauspire's client trackers plan it
 * (`executionStageDays`, `executionStepOffset`), from the day design was
 * complete, or after the last pre-execution step still open, whichever is
 * later. Steps fall off the studio's weekly off, and their "first planned"
 * day is this one. The
 * project's days end on the new handover, and `executionPlannedAt` marks the
 * plan: until it is set no handover date is shown anywhere, and the planned
 * handover counts from it (project-rules.ts `overallDelay`).
 *
 * A project whose execution already has a tick (brought in mid-way) keeps its
 * dates: only `executionPlannedAt` is set.
 */

import type { Prisma } from '@prisma/client';
import { executionFrom, planSpanDays, trackerStepDays } from '@/modules/portal/quote-to-plan';
import { bhkOf } from '@/modules/studio-design/template';
import { executionDaysFor, executionStepOffset } from './step-template';
import { propertyTypeFrom } from './own-project-rules';
import { shiftStepDay } from './step-rules';
import { calendarOf, dayToDb, EVERY_DAY, istDay, onWorkingDay, type StudioCalendar } from './working-days';

type Db = Prisma.TransactionClient;

/** The flat's size: the signed quotation's BHK, else the brief's property type (null when neither says). */
export async function projectBhk(db: Db, signedQuoteId: string | null, briefPropertyType: string | null): Promise<number | null> {
  const q = signedQuoteId ? await db.studioQuote.findUnique({ where: { id: signedQuoteId }, select: { config: true, client: { select: { config: true } } } }) : null;
  return bhkOf(propertyTypeFrom(q?.config ?? q?.client?.config) ?? briefPropertyType);
}

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
      category: true,
      signedQuoteId: true,
      introduction: { select: { studio: { select: { workingDays: true, holidays: { select: { day: true } } } }, brief: { select: { propertyType: true } } } },
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
  const days = executionDaysFor(await projectBhk(db, p.signedQuoteId, p.introduction?.brief?.propertyType ?? null), p.category);
  const plan = executionReplan(exec, start, cal, days);

  if (istDay(design.plannedEnd) !== start) await db.homeProjectStage.update({ where: { id: design.id }, data: { plannedEnd: dayToDb(start) } });
  for (const s of plan.stages) await db.homeProjectStage.update({ where: { id: s.id }, data: { plannedStart: dayToDb(s.start), plannedEnd: dayToDb(s.end) } });
  for (const st of plan.steps) await db.homeChecklistItem.update({ where: { id: st.id }, data: { plannedOn: dayToDb(st.day), firstPlannedOn: dayToDb(st.day) } });
  const span = planSpanDays(p.startOn, [{ plannedEnd: dayToDb(plan.end) }]);
  await db.homeProject.update({ where: { id: projectId }, data: { executionPlannedAt: now, ...(span ? { totalDays: span } : {}) } });
}

type ExecStage = { id: string; kind: string; plannedStart: Date; plannedEnd: Date; items: readonly { id: string; label: string; plannedOn: Date | null }[] };

/**
 * The execution stages' new dates from `start` for `days` of execution, and
 * every step's day: on its day in Hauspire's trackers (step-template.ts), a
 * step the studio added moved with its stage. Pure: the caller writes.
 */
export function executionReplan(exec: readonly ExecStage[], start: string, cal: StudioCalendar | null, days: number): { stages: { id: string; start: string; end: string }[]; steps: { id: string; day: string }[]; end: string } {
  const windows = executionFrom(start, cal, days);
  const stages: { id: string; start: string; end: string }[] = [];
  const steps: { id: string; day: string }[] = [];
  for (const s of exec) {
    const w = windows.find((x) => x.kind === s.kind);
    if (!w) continue;
    stages.push({ id: s.id, start: w.start, end: w.end });
    const tracked = trackerStepDays(w.kind, s.items.map((i) => i.label), { start: w.start, end: w.end }, days, cal);
    s.items.forEach((i, k) => {
      const known = executionStepOffset(w.kind, i.label, days) !== null;
      const day = known ? tracked[k]! : (shiftStepDay(i.plannedOn ? istDay(i.plannedOn) : null, { start: istDay(s.plannedStart), end: istDay(s.plannedEnd) }, w) ?? w.end);
      steps.push({ id: i.id, day });
    });
  }
  return { stages, steps, end: windows.at(-1)!.end };
}
