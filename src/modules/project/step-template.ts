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
}

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
  step('CARPENTRY', S2B, 'Carpentry complete and site cleaned', 3, '2026-10-10'),

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
  step('HANDOVER', HAND, 'Handover', 2, SHEET_HANDOVER),
];

/** The template's steps of one stage kind, in order. */
export function templateFor(kind: PlanKind): TemplateStep[] {
  return STEP_TEMPLATE.filter((s) => s.kind === kind);
}
