/**
 * The customer's project tracker — the stages of their home, with dates and
 * what has happened, in "Your home" (Phase 7). It had to exist before
 * "Project tracker" could be promised as a benefit (plan §17.3).
 *
 * The stages are the ones every Pune interior job goes through, in order.
 * Target dates split the studio's own duration for the work by how long each
 * stage usually takes, and a stage is done only when somebody marks it done
 * — nothing ticks itself off because a date passed.
 *
 * Pure, and tested.
 */

export const TRACKER_STAGES = [
  { key: 'DESIGN', label: 'Design signed off', share: 0.2 },
  { key: 'PRODUCTION', label: 'Factory production', share: 0.25 },
  { key: 'SITE', label: 'Site work — electrical, false ceiling, civil', share: 0.2 },
  { key: 'INSTALL', label: 'Installation', share: 0.2 },
  { key: 'FINISH', label: 'Finishing and snags', share: 0.1 },
  { key: 'HANDOVER', label: 'Handover', share: 0.05 },
] as const;

export type TrackerStageKey = (typeof TRACKER_STAGES)[number]['key'];

export const STAGE_KEYS = TRACKER_STAGES.map((s) => s.key) as readonly TrackerStageKey[];

const DAY = 86_400_000;

export interface PlannedStage {
  key: TrackerStageKey;
  label: string;
  targetOn: Date;
}

/** Target dates for each stage: the duration split by each stage's usual share. */
export function plannedStages(startOn: Date, totalDays: number): PlannedStage[] {
  let at = startOn.getTime();
  return TRACKER_STAGES.map((s) => {
    at += Math.round(s.share * totalDays) * DAY;
    return { key: s.key, label: s.label, targetOn: new Date(at) };
  });
}

export interface StageView extends PlannedStage {
  state: 'done' | 'now' | 'next' | 'later';
  /** Past its target and not done — said, not hidden. */
  late: boolean;
}

/**
 * What the customer sees: done stages ticked, the first not-done stage is
 * "now", the one after it "next". A stage only counts as done when marked.
 */
export function trackerView(planned: PlannedStage[], done: string[], now: Date): StageView[] {
  const firstOpen = planned.findIndex((p) => !done.includes(p.key));
  return planned.map((p, i) => {
    const isDone = done.includes(p.key);
    const state: StageView['state'] = isDone ? 'done' : i === firstOpen ? 'now' : i === firstOpen + 1 ? 'next' : 'later';
    return { ...p, state, late: !isDone && p.targetOn.getTime() < now.getTime() };
  });
}

/** Days from sign-off to handover for a scope, from the studio's own profile, else the usual. */
export function durationFor(scope: string | null, studioDays: Partial<Record<string, number>> | undefined): number {
  const own = scope ? studioDays?.[scope] : undefined;
  if (own) return own;
  return scope === 'KITCHEN_WARDROBE' ? 45 : scope === 'SINGLE_ROOM' ? 30 : scope === 'RENOVATION' ? 110 : 100;
}

export const UPDATE_MAX = 800;
