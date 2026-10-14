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
  return viewOf(planned, planned.map((p) => done.includes(p.key)), now);
}

function viewOf(planned: PlannedStage[], done: boolean[], now: Date): StageView[] {
  const firstOpen = done.findIndex((d) => !d);
  return planned.map((p, i) => {
    const isDone = done[i]!;
    const state: StageView['state'] = isDone ? 'done' : i === firstOpen ? 'now' : i === firstOpen + 1 ? 'next' : 'later';
    return { ...p, state, late: !isDone && p.targetOn.getTime() < now.getTime() };
  });
}

// ── The plan built from the signed quote (studio workspace Phase 1) ──

/**
 * The five kinds of stage a project's plan has (`HomeProjectStage.kind`,
 * built by quote-to-plan.ts). The studio names each stage; we own the kind.
 */
export const PLAN_KINDS = ['DESIGN', 'CIVIL', 'CARPENTRY', 'FINISH', 'HANDOVER'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

/**
 * Which of the fixed tracker stages each kind covers. Carpentry is both
 * "Factory production" and "Installation": the factory makes what the site
 * fits, and the studio ticks it off as one stage.
 */
export const KIND_TRACKER_KEYS: Record<PlanKind, readonly TrackerStageKey[]> = {
  DESIGN: ['DESIGN'],
  CIVIL: ['SITE'],
  CARPENTRY: ['PRODUCTION', 'INSTALL'],
  FINISH: ['FINISH'],
  HANDOVER: ['HANDOVER'],
};

/**
 * The key a kind goes out under in the customer payload (`stages[].key`),
 * which the website and the phone app already read and translate. Kept to
 * the old keys so neither had to change: civil work is the old "Site work"
 * (`SITE`) and carpentry the old "Installation" (`INSTALL`). The label is
 * the studio's own name for the stage.
 */
export const KIND_KEY: Record<PlanKind, TrackerStageKey> = {
  DESIGN: 'DESIGN',
  CIVIL: 'SITE',
  CARPENTRY: 'INSTALL',
  FINISH: 'FINISH',
  HANDOVER: 'HANDOVER',
};

/** The kind an old tracker key belongs to — for ticks made from the old stage list. */
export function kindForKey(key: string): PlanKind | null {
  return PLAN_KINDS.find((k) => KIND_TRACKER_KEYS[k].includes(key as TrackerStageKey)) ?? null;
}

/** A stored plan stage, as much of it as the customer's tracker needs. */
export interface PlanStageRow {
  kind: PlanKind;
  name: string;
  plannedEnd: Date;
  actualEnd: Date | null;
}

/**
 * The customer's tracker from the stored plan: same shape as `trackerView`,
 * one entry per stage in order. Done means the studio finished it
 * (`actualEnd`), never that its date passed.
 */
export function planStageView(rows: PlanStageRow[], now: Date): StageView[] {
  return viewOf(
    rows.map((r) => ({ key: KIND_KEY[r.kind], label: r.name, targetOn: r.plannedEnd })),
    rows.map((r) => r.actualEnd !== null),
    now,
  );
}

/**
 * The project's stages: the stored plan when it has one, else the fixed
 * stages and `doneStages`, as every project had before the plan existed.
 * So a project signed before quote-to-plan, and not yet backfilled
 * (scripts/studio/build-plans.ts), reads exactly as it did.
 */
export function projectStages(
  p: { startOn: Date; totalDays: number; doneStages: string[]; stages?: PlanStageRow[] | null },
  now: Date,
): StageView[] {
  if (p.stages && p.stages.length > 0) return planStageView(p.stages, now);
  return trackerView(plannedStages(p.startOn, p.totalDays), p.doneStages, now);
}

/** Days from sign-off to handover for a scope, from the studio's own profile, else the usual. */
export function durationFor(scope: string | null, studioDays: Partial<Record<string, number>> | undefined): number {
  const own = scope ? studioDays?.[scope] : undefined;
  if (own) return own;
  return scope === 'KITCHEN_WARDROBE' ? 45 : scope === 'SINGLE_ROOM' ? 30 : scope === 'RENOVATION' ? 110 : 100;
}

export const UPDATE_MAX = 800;
