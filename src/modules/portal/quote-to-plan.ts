/**
 * The plan of a signed project, built from the quote the customer signed
 * (studio workspace Phase 1, docs/studio-workspace/PHASE-1-PLAN.md §4): the
 * five stages with planned dates, each stage's steps, the payment schedule
 * and the materials list. Nobody types any of it. Pure, and tested
 * (tests/quote-to-plan.test.ts); the writes are in plan-write.ts.
 *
 * ## Stages and their dates
 *
 * Always the five kinds, in order, with default names the studio can rename
 * later. The handover days are split across them the way the customer's
 * tracker has always split them (tracker.ts `TRACKER_STAGES` shares — the
 * share of a kind is the sum of the old stages it covers, so carpentry is
 * factory production plus installation), in whole days with `splitAcross`,
 * so the last stage ends exactly on the planned handover.
 *
 * ## Steps (the step tracker, owner 11 Oct 2026)
 *
 * Every stage gets Hauspire's execution steps for its kind, with their
 * default weights (project/step-template.ts; docs/studio-workspace/
 * STEP-TRACKER.md), each step's group in `room`, and each step's planned
 * day spread across the stage's window (project/step-rules.ts
 * `spreadStepDays`). The quote's lines no longer become things to tick:
 * they are the materials list. Projects built before the step tracker have
 * one item per quote line, in its room, until
 * scripts/studio/steps-from-template.ts replaces them.
 *
 * Studio OS Phase 2 (docs/studio-os/PHASE-2-DESIGN.md): a signed or booked
 * project's DESIGN stage gets the studio's design steps instead (Hauspire's
 * 19 by default; studio-design/template.ts), sharing the stage's 2% so the
 * execution weights are unchanged, each planned the previous step's day plus
 * its gap, with its responsible role, document-required flag and payment
 * gate. With the flat size known, design lasts that size's days.
 *
 * ## Which stage a quote line's work belongs to (for the materials)
 *
 * A quote line carries a product name and a work code, nothing more, so the
 * rule reads those two, on the product NAME only (details are prose — "with
 * concealed wiring and panel lights" under a false ceiling would read as
 * electrical work). First match wins, in this order:
 *
 * 1. **Services** — supervision, project management, transport, freight,
 *    a design or professional fee, consultation: not a material.
 * 2. **Design** — design, drawings, 3D, renders, moodboard → `DESIGN`.
 * 3. **Modular** (factory-made) lines → `CARPENTRY`, whatever they are
 *    called: a wardrobe, a vanity, a mirror cabinet are all built in the
 *    factory and fitted by the carpenters.
 * 4. On-site lines, by name:
 *    - cleaning, handover → `HANDOVER`
 *    - paint, polish, putty, texture, wallpaper, curtains, blinds,
 *      upholstery, sofa, mirror, glass, décor, light fittings, fans →
 *      `FINISH` (checked before civil and carpentry, so "PU polish on
 *      woodwork" is finishing and "Mirror, edge polished" is too)
 *    - civil, breaking, demolition, tiles, dado, flooring, ceiling, gypsum,
 *      POP, electrical, wiring, points, plumbing, waterproofing, doors,
 *      windows, grills → `CIVIL`
 *    - carpentry, wood, ply, laminate, veneer, wardrobe, cabinet, shutter,
 *      unit, panel, bed, shelves, storage, countertop, granite, stone,
 *      marble, quartz → `CARPENTRY` (a countertop goes on once the kitchen
 *      carcass is fixed)
 *    - anything else on site → `CIVIL`, the stage where site work happens.
 *
 * ## Payments
 *
 * The stages the customer signed (`FinalQuoteView.stages`), split again over
 * the contract with `splitAcross` so they sum to it exactly: by their
 * percentages when every stage has one, else by their amounts. A quote with
 * no stages gets the brief's standard 40 / 40 / 20.
 *
 * ## Materials
 *
 * Every line whose work is civil, carpentry or finishing, with the line's
 * details as the spec. Design, handover and service lines are not materials.
 */

import { splitAcross } from '@/lib/money';
import { templateFor } from '@/modules/project/step-template';
import { designSteps } from '@/modules/studio-design/rules';
import { designDaysFor, HAUSPIRE_DESIGN, type DesignTemplateStep } from '@/modules/studio-design/template';
import { spreadStepDays } from '@/modules/project/step-rules';
import { dayToDb, istDay } from '@/modules/project/working-days';
import { KIND_TRACKER_KEYS, PLAN_KINDS, TRACKER_STAGES, type PlanKind } from './tracker';

export type { PlanKind } from './tracker';

/** The default name of each stage (the step tracker's names). The studio may rename; we read the kind. */
export const KIND_NAMES: Record<PlanKind, string> = {
  DESIGN: 'Design',
  CIVIL: 'POP, civil and electricals',
  CARPENTRY: 'Carpentry',
  FINISH: 'Finishing',
  HANDOVER: 'Handover',
};

/** Where a quote line with no room is filed in the materials. */
export const WHOLE_HOME = 'Whole home';

/** The brief's schedule, for a quote that carried none. */
export const STANDARD_PAYMENTS = [
  { label: 'At signing', pct: 40 },
  { label: 'When finishing starts', pct: 40 },
  { label: 'At handover', pct: 20 },
] as const;

export interface PlanQuoteLine {
  id: string;
  room: string;
  product: string;
  details: string | null;
  code: 'MODULAR' | 'ONSITE';
}

export interface SignedStageInput {
  label: string;
  pct: number | null;
  amountPaise: number;
}

/** One step of a stage, stored as a `HomeChecklistItem`. */
export interface PlanItem {
  /** The step's group ("Execution stage 2A"), stored in the `room` column. */
  room: string;
  label: string;
  /** Null on a step; set only on the older quote-line items. */
  quoteLineId: string | null;
  sortOrder: number;
  /** Basis points of the project (project/step-rules.ts reads the effective weight). */
  weightBp: number;
  inScope: boolean;
  /** The step's planned day, as the plan's dates are stored (midnight UTC = the IST day). */
  plannedOn: Date | null;
  /** Set only by the backfills, with its stage's `actualEnd`. */
  doneAt?: Date | null;
  /** BACKFILL on a step ticked because its stage was already done: no photo. */
  doneSource?: 'BACKFILL' | null;
  /* Studio OS Phase 2: a design step's who, file, payment gate and days after the previous step. */
  responsible?: string | null;
  needsDocument?: boolean;
  gatePayment?: number | null;
  gapDays?: number | null;
}

/**
 * Studio OS Phase 2 (docs/studio-os/PHASE-2-DESIGN.md): what the DESIGN
 * stage is built from — the studio's design steps (Hauspire's when null) and
 * the flat size, which sets how long design lasts (studio-design/template.ts
 * `DESIGN_DAYS`). Without a flat size, design keeps its usual share.
 */
export interface DesignPlanInput {
  template?: readonly DesignTemplateStep[] | null;
  bhk?: number | null;
}

export interface PlanStage {
  kind: PlanKind;
  name: string;
  sortOrder: number;
  plannedStart: Date;
  plannedEnd: Date;
  /** Set only by the backfill, for a stage the old tracker already had ticked. */
  actualEnd: Date | null;
  items: PlanItem[];
}

export interface PlanPayment {
  label: string;
  pct: number | null;
  amountPaise: number;
}

export interface PlanMaterial {
  room: string;
  item: string;
  spec: string | null;
  quoteLineId: string;
  sortOrder: number;
}

export interface QuotePlan {
  stages: PlanStage[];
  payments: PlanPayment[];
  materials: PlanMaterial[];
}

// ── Which stage a line belongs to ──────────────────────────────

const SERVICE = /supervision|project management|transport|freight|cartage|delivery charge|design fee|professional fee|consultation/;
const DESIGN = /\bdesign\b|\bdrawings?\b|\b3d\b|\brenders?\b|\bmoodboard\b/;
const HANDOVER = /clean|handover/;
const FINISH = /paint|polish|putty|texture|wallpaper|curtain|blind|upholster|sofa|mirror|glass|d[eé]cor|light fitting|chandelier|\bfans?\b/;
const CIVIL = /civil|break|demoli|\btil(e|es|ing)\b|dado|floor|ceiling|gypsum|\bpop\b|electric|wiring|\bpoints?\b|plumb|waterproof|\bdoors?\b|window|grill/;
const CARPENTRY = /carpent|wood|\bply|laminate|veneer|wardrobe|cabinet|shutter|\bunits?\b|panel|\bbed\b|shel(f|ves)|storage|countertop|granite|stone|marble|quartz/;

/** The stage a quote line's work belongs to, or null for a service line (not a material). See the rule above. */
export function stageForLine(line: Pick<PlanQuoteLine, 'product' | 'code'>): PlanKind | null {
  const name = line.product.toLowerCase();
  if (SERVICE.test(name)) return null;
  if (DESIGN.test(name)) return 'DESIGN';
  if (line.code === 'MODULAR') return 'CARPENTRY';
  if (HANDOVER.test(name)) return 'HANDOVER';
  if (FINISH.test(name)) return 'FINISH';
  if (CIVIL.test(name)) return 'CIVIL';
  if (CARPENTRY.test(name)) return 'CARPENTRY';
  return 'CIVIL';
}

// ── Dates ──────────────────────────────────────────────────────

const DAY = 86_400_000;

/** Each kind's share of the handover days: the sum of the old tracker stages it covers, in whole percent. */
export function kindWeights(): number[] {
  return PLAN_KINDS.map((k) =>
    Math.round(KIND_TRACKER_KEYS[k].reduce((sum, key) => sum + TRACKER_STAGES.find((s) => s.key === key)!.share, 0) * 100),
  );
}

/**
 * Planned start and end of each stage, back to back from the start, the last
 * ending on handover. With `designDays` (Studio OS Phase 2: the flat size's
 * design days), design lasts exactly that and the other four share the rest
 * by their usual weights — when that leaves each of them at least a day.
 */
export function stageDates(startOn: Date, totalDays: number, designDays: number | null = null): { kind: PlanKind; plannedStart: Date; plannedEnd: Date }[] {
  const total = Math.max(0, Math.round(totalDays));
  const weights = kindWeights();
  const fixed = designDays !== null && Number.isInteger(designDays) && designDays > 0 && total - designDays >= PLAN_KINDS.length - 1;
  const days = fixed ? [designDays, ...splitAcross(total - designDays, weights.slice(1))] : splitAcross(total, weights);
  let at = startOn.getTime();
  return PLAN_KINDS.map((kind, i) => {
    const plannedStart = new Date(at);
    at += days[i]! * DAY;
    return { kind, plannedStart, plannedEnd: new Date(at) };
  });
}

// ── Payments ───────────────────────────────────────────────────

/** The payment schedule, summing exactly to the contract. Empty when there is no contract to split. */
export function paymentSchedule(contractPaise: number, signed: SignedStageInput[]): PlanPayment[] {
  if (!Number.isInteger(contractPaise) || contractPaise <= 0) return [];
  const byPct = signed.length > 0 && signed.every((s) => s.pct !== null && s.pct > 0);
  const byAmount = signed.length > 0 && signed.every((s) => s.amountPaise >= 0) && signed.some((s) => s.amountPaise > 0);
  if (!byPct && !byAmount) {
    const parts = splitAcross(contractPaise, STANDARD_PAYMENTS.map((p) => p.pct));
    return STANDARD_PAYMENTS.map((p, i) => ({ label: p.label, pct: p.pct, amountPaise: parts[i]! }));
  }
  const parts = splitAcross(contractPaise, signed.map((s) => (byPct ? s.pct! : s.amountPaise)));
  return signed.map((s, i) => ({ label: s.label, pct: s.pct, amountPaise: parts[i]! }));
}

// ── The plan ───────────────────────────────────────────────────

export interface QuotePlanInput {
  /** In the quote's own order. */
  lines: PlanQuoteLine[];
  startOn: Date;
  totalDays: number;
  contractPaise: number;
  /** The payment stages as signed. */
  stages: SignedStageInput[];
  /** Studio OS Phase 2: the studio's design steps and the flat size. Hauspire's steps when left out. */
  design?: DesignPlanInput | null;
}

/** A stage's template steps, each with its planned day inside the stage's window. */
export function stepsFor(kind: PlanKind, plannedStart: Date, plannedEnd: Date): PlanItem[] {
  const template = templateFor(kind);
  const days = spreadStepDays(
    template.map((t) => t.sheetDay),
    { start: istDay(plannedStart), end: istDay(plannedEnd) },
  );
  return template.map((t, i) => ({
    room: t.group,
    label: t.label,
    quoteLineId: null,
    sortOrder: i,
    weightBp: t.weightBp,
    inScope: true,
    plannedOn: dayToDb(days[i]!),
  }));
}

/**
 * The DESIGN stage's design steps (Studio OS Phase 2): the studio's template
 * (Hauspire's when none), each step the previous one's day plus its gap,
 * scaled to the stage's window, gates matched to the payment stages by name
 * (studio-design/rules.ts `designSteps`).
 */
export function designStepsFor(plannedStart: Date, plannedEnd: Date, template: readonly DesignTemplateStep[] | null | undefined, payments: readonly { label: string }[]): PlanItem[] {
  return designSteps(template && template.length ? template : HAUSPIRE_DESIGN, { start: istDay(plannedStart), end: istDay(plannedEnd) }, payments).map((st) => ({
    room: st.room,
    label: st.label,
    quoteLineId: null,
    sortOrder: st.sortOrder,
    weightBp: st.weightBp,
    inScope: true,
    plannedOn: dayToDb(st.plannedOn),
    responsible: st.responsible,
    needsDocument: st.needsDocument,
    gatePayment: st.gatePayment,
    gapDays: st.gapDays,
  }));
}

/**
 * The five stages with their dates, default names and template steps. With
 * `design` (a signed or booked project), the DESIGN stage gets the design
 * steps and, when the flat size is known, its design days; without it (a
 * tracker ops started by hand) the stages are as before.
 */
export function templateStages(startOn: Date, totalDays: number, design?: (DesignPlanInput & { payments: readonly { label: string }[] }) | null): PlanStage[] {
  return stageDates(startOn, totalDays, design ? designDaysFor(design.bhk) : null).map((d, i) => ({
    ...d,
    name: KIND_NAMES[d.kind],
    sortOrder: i,
    actualEnd: null,
    items: design && d.kind === 'DESIGN' ? designStepsFor(d.plannedStart, d.plannedEnd, design.template, design.payments) : stepsFor(d.kind, d.plannedStart, d.plannedEnd),
  }));
}

/** Signed quote → stages with their steps, the payment schedule and the materials. */
export function quoteToPlan(input: QuotePlanInput): QuotePlan {
  const materials: PlanMaterial[] = [];
  for (const line of input.lines) {
    const kind = stageForLine(line);
    if (kind !== 'CIVIL' && kind !== 'CARPENTRY' && kind !== 'FINISH') continue;
    materials.push({
      room: line.room.trim() || WHOLE_HOME,
      item: line.product.trim() || 'Item',
      spec: line.details?.trim() || null,
      quoteLineId: line.id,
      sortOrder: materials.length,
    });
  }
  const payments = paymentSchedule(input.contractPaise, input.stages);
  return { stages: templateStages(input.startOn, input.totalDays, { ...(input.design ?? {}), payments }), payments, materials };
}

/**
 * The plan of a project that has no signed quote to read (a tracker ops
 * started by hand): the five stages and their template steps, with the
 * stages the old tracker had ticked carried over as done.
 */
export function trackerToPlan(input: { startOn: Date; totalDays: number; doneStages: string[] }, now: Date): PlanStage[] {
  return carryDone(templateStages(input.startOn, input.totalDays), input.doneStages, now);
}

/**
 * Stages the old tracker had marked done (`HomeProject.doneStages`) stay
 * done in the plan: a kind is done when every old stage it covers was. When
 * it was done was never recorded, so `actualEnd` is the planned end, or
 * today if that is still ahead — never a date later than the truth could be.
 * Their steps are ticked with it, with no photo (`doneSource` BACKFILL).
 */
export function carryDone(stages: PlanStage[], doneStages: string[], now: Date): PlanStage[] {
  return stages.map((s) => {
    const done = KIND_TRACKER_KEYS[s.kind].every((k) => doneStages.includes(k));
    if (!done) return s;
    const actualEnd = new Date(Math.min(s.plannedEnd.getTime(), now.getTime()));
    return { ...s, actualEnd, items: s.items.map((it) => ({ ...it, doneAt: actualEnd, doneSource: 'BACKFILL' as const })) };
  });
}
