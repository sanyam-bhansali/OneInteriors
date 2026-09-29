/**
 * The whole customer journey as a funnel, for the pilot's one number: of the
 * people who finish the brief, how many book the expert call. The owner's
 * target is 40–50% (30 Sep 2026).
 *
 * Counted from the rows themselves — briefs, calls, introductions, decisions —
 * for the briefs started in the window, so every stage is the same cohort.
 *
 * Pure, and tested.
 */

export const CALL_TARGET = { low: 0.4, high: 0.5 } as const;

export interface JourneyCounts {
  started: number;
  finished: number;
  leftNumber: number;
  matched: number;
  callBooked: number;
  callDone: number;
  introduced: number;
  signed: number;
}

export const JOURNEY_LABELS: Record<keyof JourneyCounts, string> = {
  started: 'Started the brief',
  finished: 'Finished it',
  leftNumber: 'Left a number',
  matched: 'Saw their matches',
  callBooked: 'Booked the expert call',
  callDone: 'Had the call',
  introduced: 'Introduced to a studio',
  signed: 'Signed with a studio',
};

export interface JourneyStage {
  key: keyof JourneyCounts;
  label: string;
  count: number;
  /** Share of the stage before; null when the stage before is empty. */
  fromPrevious: number | null;
}

export function journeyStages(c: JourneyCounts): JourneyStage[] {
  const keys = Object.keys(JOURNEY_LABELS) as (keyof JourneyCounts)[];
  return keys.map((key, i) => {
    const prev = i === 0 ? null : c[keys[i - 1]!];
    return {
      key,
      label: JOURNEY_LABELS[key],
      count: c[key],
      fromPrevious: prev === null || prev === 0 ? null : c[key] / prev,
    };
  });
}

/** Finished brief → booked call, against the target. Null with no finished briefs. */
export function callRate(c: JourneyCounts): { rate: number; verdict: 'below' | 'on' | 'above' } | null {
  if (c.finished === 0) return null;
  const rate = c.callBooked / c.finished;
  return { rate, verdict: rate < CALL_TARGET.low ? 'below' : rate > CALL_TARGET.high ? 'above' : 'on' };
}
