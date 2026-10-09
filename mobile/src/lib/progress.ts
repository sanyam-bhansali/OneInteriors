import type { Stage } from './types';

/** Where the project stands, from its stages. Pure; `now` is passed in. */

const DAY = 86_400_000;

/** Day N of M since the start, M being the planned days to handover. */
export function dayOf(startOn: string, stages: Stage[], now: number): { day: number; of: number } {
  const start = Date.parse(startOn);
  const end = stages.length ? Date.parse(stages[stages.length - 1]!.targetOn) : start;
  return { day: Math.max(1, Math.floor((now - start) / DAY) + 1), of: Math.max(1, Math.round((end - start) / DAY)) };
}

/** Whole days the latest late stage is past its date; 0 when on time. */
export function daysLate(stages: Stage[], now: number): number {
  return Math.max(0, ...stages.filter((s) => s.late).map((s) => Math.floor((now - Date.parse(s.targetOn)) / DAY)));
}
