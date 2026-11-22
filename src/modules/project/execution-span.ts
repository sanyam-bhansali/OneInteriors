/**
 * The execution's dates for the Execution tab (owner, 22 Nov 2026: "it should show execution start date and
 * handover date and working days taken for completing this project"): from the first execution stage's start to
 * the handover — the day it was handed over when it has been (provisional handover), else the last stage's
 * planned end — and the studio's working days in between, both ends included (its weekly off and holidays
 * skipped). Nothing until the execution has been planned (it is planned when design ends). Pure; tested in
 * tests/execution-span.test.ts.
 */
import { addDays, daysBetween, isDay, workingDaysBetween, type StudioCalendar } from './working-days';

export interface ExecutionSpan {
  startOn: string;
  handoverOn: string;
  /** The handover has happened (provisional handover), rather than planned. */
  handedOver: boolean;
  workingDays: number;
}

export function executionSpan(
  stages: readonly { kind: string; plannedStart: string; plannedEnd: string }[],
  opts: { planned: boolean; handedOverOn: string | null },
  cal: StudioCalendar,
): ExecutionSpan | null {
  if (!opts.planned) return null;
  const exec = stages.filter((s) => s.kind !== 'DESIGN');
  const first = exec[0];
  const last = exec[exec.length - 1];
  if (!first || !last || !isDay(first.plannedStart) || !isDay(last.plannedEnd)) return null;
  const startOn = first.plannedStart;
  const handedOver = opts.handedOverOn !== null && isDay(opts.handedOverOn);
  const handoverOn = handedOver ? opts.handedOverOn! : last.plannedEnd;
  if (daysBetween(startOn, handoverOn) < 0) return null;
  return { startOn, handoverOn, handedOver, workingDays: workingDaysBetween(addDays(startOn, -1), handoverOn, cal) };
}
