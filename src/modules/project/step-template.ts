/**
 * Hauspire's execution steps, with their default weights and planned days
 * (owner, 11 Oct 2026; docs/studio-workspace/STEP-TRACKER.md). Every new
 * project's plan starts from this list (portal/quote-to-plan.ts); the studio
 * may rename, re-weight, add, remove or mark steps not in scope afterwards.
 * Pure data, tested in tests/step-template.test.ts.
 *
 * - **Stage kinds** stay the five we read everywhere; the sheet's sections
 *   become step **groups** inside a stage (stored in the item's `room`
 *   column).
 * - **Weights** are basis points (10 000 = 100%) and sum to exactly 10 000.
 * - **Sheet days** are the "Expected date" of each step on the sheet the
 *   template was taken from (start 17 Jul 2026, handover 4 Nov 2026). They
 *   are never shown: step-rules.ts `spreadStepDays` turns them into each
 *   step's planned day inside its own project's stage window.
 * - **Milestones** (owner, 12 Oct 2026; docs/studio-os/CUSTOMER-MILESTONES.md):
 *   2–3 starred steps per stage are what the customer sees under it. The
 *   studio stars or unstars any step on a project's Plan tab; these are the
 *   defaults a new plan starts with (and the migration's backfill, by name).
 */

import type { PlanKind } from '@/modules/portal/tracker';

export interface TemplateStep {
  kind: PlanKind;
  group: string;
  label: string;
  /** Basis points of the whole project. */
  weightBp: number;
  /** The step's expected day on the source sheet, 'YYYY-MM-DD'. */
  sheetDay: string;
  /** Starred by default: one of the stage's milestones the customer sees. */
  milestone: boolean;
}

/**
 * The default stars, by stage kind and step name. Kept in step with the
 * backfill in prisma/migrations/20261012170000_customer_milestones.
 */
export const TEMPLATE_MILESTONES: Readonly<Record<PlanKind, readonly string[]>> = {
  DESIGN: ['Final design and drawings signed off'],
  CIVIL: ['POP, civil, fabrication and electrical work started', 'POP sheets'],
  CARPENTRY: ['Materials delivered from the factory', 'Carcass complete with hardware', 'Shutters delivered'],
  FINISH: ['Painting started', 'Painting complete'],
  HANDOVER: ['Snags listed', 'Provisional handover'],
};

/**
 * The project closure step (owner, 13 Nov 2026): the last carpentry step, after the shutters. It shows in the
 * execution timeline and in My work; ticking it shows the payments still due (closure-due.ts). It does not move the
 * project's lifecycle (the provisional handover still does).
 */
export const PROJECT_CLOSURE_STEP = 'Project closure';
/** Is this step the project closure? By name, as every template step is matched (lifecycle-rules.ts does the same). */
export const isProjectClosureStep = (label: string): boolean => label.trim().toLowerCase() === PROJECT_CLOSURE_STEP.toLowerCase();

/** The sheet's first day: where every offset counts from. */
export const SHEET_START = '2026-07-17';
/** The sheet's handover. */
export const SHEET_HANDOVER = '2026-11-04';

const step = (kind: PlanKind, group: string, label: string, pct: number, sheetDay: string): TemplateStep => ({
  kind,
  group,
  label,
  weightBp: Math.round(pct * 100),
  sheetDay,
  milestone: TEMPLATE_MILESTONES[kind].includes(label),
});

const S1 = 'Execution stage 1';
const S2A = 'Execution stage 2A';
const S2B = 'Execution stage 2B';
const FIN = 'Finishing';
const PREP = 'Handover preparation';
const HAND = 'Handover';

/** In the sheet's order. Stage order follows `PLAN_KINDS`. */
export const STEP_TEMPLATE: readonly TemplateStep[] = [
  step('DESIGN', 'Design', 'Final design and drawings signed off', 2, SHEET_START),

  step('CIVIL', S1, 'POP, civil, fabrication and electrical work started', 1, '2026-07-17'),
  step('CIVIL', S1, 'POP framing', 4, '2026-07-22'),
  step('CIVIL', S1, 'POP wiring', 3, '2026-07-25'),
  step('CIVIL', S1, 'POP sheets', 4, '2026-07-27'),
  step('CIVIL', S1, 'POP lights', 2, '2026-07-28'),
  step('CIVIL', S1, 'PVC POP work', 2, '2026-07-29'),
  step('CIVIL', S1, 'Fabrication work', 3, '2026-08-01'),
  step('CIVIL', S1, 'Civil work', 4, '2026-08-04'),

  step('CARPENTRY', S2A, 'Site inspection of POP and civil work by the designer', 1, '2026-08-06'),
  // In Hauspire's client trackers (owner, 21 Nov 2026) the factory delivers on carpentry's first day, before the carpenters start.
  step('CARPENTRY', S2A, 'Materials delivered from the factory', 3, '2026-08-06'),
  step('CARPENTRY', S2A, 'Material at site: moulding, safety-door jali, ply', 2, '2026-08-09'),
  step('CARPENTRY', S2A, 'Site discussion and carpentry started', 1, '2026-08-10'),
  step('CARPENTRY', S2A, 'Hardware stage 1 ordered (tandems, channels, folding mechanisms)', 1, '2026-09-05'),
  step('CARPENTRY', S2A, 'CNC work and PU material ordered', 1, '2026-09-05'),
  step('CARPENTRY', S2A, 'Carcass complete with hardware', 10, '2026-09-15'),
  step('CARPENTRY', S2A, 'Shutters measured and ordered', 1, '2026-09-16'),
  step('CARPENTRY', S2A, 'Hardware stage 2 ordered (hinges, handles, push magnets, hydraulics)', 1, '2026-09-20'),
  step('CARPENTRY', S2A, 'Handles, knobs and locks ordered', 1, '2026-09-20'),
  step('CARPENTRY', S2A, 'Site inspection at carcass stage by the designer', 1, '2026-09-20'),
  step('CARPENTRY', S2B, 'Name plate ordered', 0.5, '2026-09-20'),
  step('CARPENTRY', S2B, 'Temple acrylic and small items ordered', 0.5, '2026-09-22'),
  step('CARPENTRY', S2B, 'Manual carpentry work complete', 6, '2026-09-25'),
  step('CARPENTRY', S2B, 'Painting putty started', 2, '2026-09-26'),
  step('CARPENTRY', S2B, 'Shutters delivered', 4, '2026-09-30'),
  step('CARPENTRY', S2B, 'Hardware stage 2 delivered', 1, '2026-09-30'),
  step('CARPENTRY', S2B, 'Profile door, mirror, headboard and wallpaper ordered', 1, '2026-09-30'),
  step('CARPENTRY', S2B, 'Handles and locks installed', 3, '2026-10-05'),
  step('CARPENTRY', S2B, 'Site inspection at shutter stage by the designer', 1, '2026-10-05'),
  step('CARPENTRY', S2B, 'Safety door installed', 2, '2026-10-06'),
  step('CARPENTRY', S2B, 'Carpentry complete and site cleaned', 2, '2026-10-10'),
  /* Project closure as an activity (owner, 13 Nov 2026: "after the shutters stage, this should happen"): late extras
     raised and paid 100% in advance, and the handover payment closed ("I give you the keys today, you give me the
     money"). 1% taken from the step before it, so carpentry still weighs 47%. */
  step('CARPENTRY', S2B, PROJECT_CLOSURE_STEP, 1, '2026-10-10'),

  step('FINISH', FIN, 'Profile door and mirror installed', 3, '2026-10-12'),
  step('FINISH', FIN, 'Painting started', 2, '2026-10-12'),
  step('FINISH', FIN, 'Painting complete', 8, '2026-10-22'),
  step('FINISH', FIN, 'Cleaning started', 1, '2026-10-23'),
  step('FINISH', FIN, 'Cleaning complete', 2, '2026-10-25'),
  step('FINISH', FIN, 'Name plate installed', 1, '2026-10-26'),

  step('HANDOVER', PREP, 'Headboard and wallpaper installed', 3, '2026-10-26'),
  step('HANDOVER', PREP, 'Snags listed', 1, '2026-10-27'),
  step('HANDOVER', PREP, 'Snag list closed', 2, '2026-10-28'),
  step('HANDOVER', PREP, 'Site inspection by the designer', 1, '2026-10-28'),
  step('HANDOVER', HAND, 'Final inspection with the client', 1, '2026-10-30'),
  step('HANDOVER', HAND, 'Final snags closed', 1, '2026-11-01'),
  // The provisional handover (owner, 13 Oct 2026): its tick moves the project to the project closure (lifecycle-rules.ts). Hauspire's "Handover", renamed; same weight.
  step('HANDOVER', HAND, 'Provisional handover', 2, SHEET_HANDOVER),
];

const dayNo = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;

/**
 * How long each execution stage lasts on the sheet, in calendar days (owner,
 * 21 Nov 2026: "Execution timeline is not proper"; execution follows Hauspire's
 * sheet after design ends, ~110 days, instead of what was left of the
 * project's days after design). A stage runs from its first step's day to the
 * next stage's first step's day; handover ends on the sheet's handover.
 * Civil 20, carpentry 67, finishing 14, handover 9.
 */
export function executionSheetDays(): { kind: Exclude<PlanKind, 'DESIGN'>; days: number }[] {
  const kinds = ['CIVIL', 'CARPENTRY', 'FINISH', 'HANDOVER'] as const;
  const firstDay = (k: PlanKind) => STEP_TEMPLATE.filter((s) => s.kind === k).reduce((a, s) => (s.sheetDay < a ? s.sheetDay : a), '9999-12-31');
  return kinds.map((kind, i) => {
    const next = i + 1 < kinds.length ? firstDay(kinds[i + 1]!) : SHEET_HANDOVER;
    return { kind, days: Math.max(1, dayNo(next) - dayNo(firstDay(kind))) };
  });
}

/** Execution's whole length on the sheet, in days (110): the stages' shares, not a project's length. */
export const EXECUTION_DAYS = executionSheetDays().reduce((a, s) => a + s.days, 0);

/**
 * How long execution takes (owner, 21 Nov 2026): "2 Bhk - 45 Days, 3 Bhk 60
 * Days, 4 Bhk 75 Days Essential increase premium by 20 % and luxe by 40%".
 * Essential is the base. 1 BHK (not given) is 30, 15 less as each size
 * steps; bigger than 4 BHK is a 4 BHK's. A flat of unknown size is a 2 BHK
 * and a project with no category Premium, as the design days are
 * (studio-design/template.ts).
 */
export const EXECUTION_DAYS_BY_BHK: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 30, 2: 45, 3: 60, 4: 75 };
export const EXECUTION_CATEGORY_FACTOR: Readonly<Record<string, number>> = { ESSENTIAL: 1, PREMIUM: 1.2, LUXURY: 1.4 };

export function executionDaysFor(bhk: number | null | undefined, category: string | null | undefined): number {
  const size = (bhk ? Math.min(4, Math.max(1, Math.round(bhk))) : 2) as 1 | 2 | 3 | 4;
  const factor = EXECUTION_CATEGORY_FACTOR[category ?? 'PREMIUM'] ?? EXECUTION_CATEGORY_FACTOR.PREMIUM!;
  return Math.round(EXECUTION_DAYS_BY_BHK[size] * factor);
}

/*
 * Hauspire's client execution trackers (owner, 21 Nov 2026: 57 of them, "analyze
 * to properly update it"). They are planned on three templates, 45, 60 and 70
 * days; the 110-day sheet above was a one-off. Each step's day from the start
 * of execution in each, the median across the trackers (the 43/58/68-day ones
 * are the same templates starting framing a day or two earlier):
 *
 *   stages      45-day   60-day   70-day
 *   civil       0–11     0–11     0–15
 *   carpentry   11–28    11–35    15–40
 *   finishing   28–35    35–47    40–56
 *   handover    35–45    47–60    56–70
 */
export const TRACKER_LENGTHS = [45, 60, 70] as const;
type ExecKind = Exclude<PlanKind, 'DESIGN'>;
const EXEC_KINDS: readonly ExecKind[] = ['CIVIL', 'CARPENTRY', 'FINISH', 'HANDOVER'];
/** The day each stage starts in each tracker. */
const TRACKER_STAGE_FROM: Readonly<Record<ExecKind, readonly [number, number, number]>> = {
  CIVIL: [0, 0, 0],
  CARPENTRY: [11, 11, 15],
  FINISH: [28, 35, 40],
  HANDOVER: [35, 47, 56],
};
/** Each step's day from the start of execution in the 45-, 60- and 70-day trackers, by the step's name here. */
const TRACKER_STEP_DAYS: Readonly<Record<string, readonly [number, number, number]>> = {
  'pop, civil, fabrication and electrical work started': [0, 0, 0],
  'pop framing': [2, 2, 2],
  'pop wiring': [4, 4, 4],
  'pop sheets': [5, 6, 6],
  'pop lights': [6, 7, 9],
  'pvc pop work': [7, 7, 10],
  'fabrication work': [9, 9, 12],
  'civil work': [10, 10, 13],
  'site inspection of pop and civil work by the designer': [11, 11, 15],
  'material at site: moulding, safety-door jali, ply': [11, 11, 15],
  'site discussion and carpentry started': [12, 12, 16],
  'materials delivered from the factory': [11, 11, 15],
  'hardware stage 1 ordered (tandems, channels, folding mechanisms)': [15, 16, 22],
  'cnc work and pu material ordered': [15, 16, 22],
  'carcass complete with hardware': [16, 18, 25],
  'shutters measured and ordered': [16, 18, 25],
  'hardware stage 2 ordered (hinges, handles, push magnets, hydraulics)': [17, 19, 26],
  'handles, knobs and locks ordered': [17, 19, 26],
  'site inspection at carcass stage by the designer': [17, 19, 26],
  'name plate ordered': [17, 19, 26],
  'temple acrylic and small items ordered': [17, 19, 26],
  'manual carpentry work complete': [19, 21, 30],
  'painting putty started': [21, 24, 35],
  'shutters delivered': [24, 28, 35],
  'hardware stage 2 delivered': [24, 28, 35],
  'profile door, mirror, headboard and wallpaper ordered': [24, 28, 35],
  'handles and locks installed': [26, 32, 37],
  'site inspection at shutter stage by the designer': [26, 32, 37],
  'safety door installed': [27, 34, 38],
  'carpentry complete and site cleaned': [28, 35, 40],
  // Ours (owner, 13 Nov 2026): the project closure falls with carpentry complete.
  'project closure': [28, 35, 40],
  'profile door and mirror installed': [28, 35, 40],
  'painting started': [28, 35, 41],
  'painting complete': [31, 42, 49],
  'cleaning started': [32, 43, 50],
  'cleaning complete': [34, 46, 55],
  'name plate installed': [35, 47, 56],
  'headboard and wallpaper installed': [35, 47, 56],
  'snags listed': [36, 48, 57],
  'snag list closed': [38, 51, 60],
  'site inspection by the designer': [39, 53, 61],
  'final inspection with the client': [40, 55, 63],
  'final snags closed': [42, 58, 68],
  'provisional handover': [45, 60, 70],
};

/** The tracker a project's execution length is planned on (the nearest), and how much it is stretched. */
function trackerFor(total: number): { i: 0 | 1 | 2; f: number } {
  const t = Math.max(EXEC_KINDS.length, Math.round(total));
  let i: 0 | 1 | 2 = 0;
  TRACKER_LENGTHS.forEach((L, k) => {
    if (Math.abs(L - t) < Math.abs(TRACKER_LENGTHS[i] - t)) i = k as 0 | 1 | 2;
  });
  return { i, f: t / TRACKER_LENGTHS[i] };
}

/** Each stage's first day from the start of execution, for this length (whole days, each stage at least one day). */
function stageStarts(total: number): number[] {
  const t = Math.max(EXEC_KINDS.length, Math.round(total));
  const { i, f } = trackerFor(t);
  const starts = EXEC_KINDS.map((k) => Math.round(TRACKER_STAGE_FROM[k][i] * f));
  for (let k = 1; k < starts.length; k++) if (starts[k]! <= starts[k - 1]!) starts[k] = starts[k - 1]! + 1;
  for (let k = starts.length - 1; k >= 1; k--) if (starts[k]! > t - (starts.length - k)) starts[k] = t - (starts.length - k);
  return starts;
}

/**
 * Each execution stage's days for a project's execution length, as Hauspire's
 * trackers split it: the nearest tracker (45, 60 or 70 days) stretched to the
 * length, in whole days that add up to exactly `total`, each at least one.
 */
export function executionStageDays(total: number): { kind: ExecKind; days: number }[] {
  const t = Math.max(EXEC_KINDS.length, Math.round(total));
  const starts = stageStarts(t);
  return EXEC_KINDS.map((kind, k) => ({ kind, days: (k + 1 < starts.length ? starts[k + 1]! : t) - starts[k]! }));
}

/**
 * A step's day inside its stage (0 = the stage's first day) for this execution
 * length, from the trackers; null for a step the trackers do not have (one the
 * studio added), which the caller places itself.
 */
export function executionStepOffset(kind: ExecKind, label: string, total: number): number | null {
  const d = TRACKER_STEP_DAYS[label.trim().toLowerCase()];
  if (!d) return null;
  const t = Math.max(EXEC_KINDS.length, Math.round(total));
  const { i, f } = trackerFor(t);
  const k = EXEC_KINDS.indexOf(kind);
  const starts = stageStarts(t);
  const from = starts[k]!;
  const to = k + 1 < starts.length ? starts[k + 1]! : t;
  return Math.min(to - from, Math.max(0, Math.round(d[i] * f) - from));
}

/** The template's steps of one stage kind, in order. */
export function templateFor(kind: PlanKind): TemplateStep[] {
  return STEP_TEMPLATE.filter((s) => s.kind === kind);
}
