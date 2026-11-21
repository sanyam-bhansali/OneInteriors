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
  step('CARPENTRY', S2A, 'Material at site: moulding, safety-door jali, ply', 2, '2026-08-09'),
  step('CARPENTRY', S2A, 'Site discussion and carpentry started', 1, '2026-08-10'),
  step('CARPENTRY', S2A, 'Materials delivered from the factory', 3, '2026-08-26'),
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

/**
 * Each execution stage's days for a project's execution length: the sheet's
 * shares (civil 20, carpentry 67, finishing 14, handover 9 of 110), in whole
 * days that add up to exactly `total`, each at least one day.
 */
export function executionStageDays(total: number): { kind: Exclude<PlanKind, 'DESIGN'>; days: number }[] {
  const sheet = executionSheetDays();
  const whole = Math.max(sheet.length, Math.round(total));
  // Largest remainder, so the parts add up to the whole.
  const exact = sheet.map((s) => (s.days * whole) / EXECUTION_DAYS);
  const days = exact.map((x) => Math.max(1, Math.floor(x)));
  let left = whole - days.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) days[order[k]!.i]! += 1;
  for (let i = days.length - 1; left < 0 && i >= 0; i--) while (left < 0 && days[i]! > 1) { days[i]! -= 1; left++; }
  return sheet.map((s, i) => ({ kind: s.kind, days: days[i]! }));
}

/** The template's steps of one stage kind, in order. */
export function templateFor(kind: PlanKind): TemplateStep[] {
  return STEP_TEMPLATE.filter((s) => s.kind === kind);
}
