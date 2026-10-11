/**
 * The plan of a signed project, built from the quote the customer signed
 * (studio workspace Phase 1, docs/studio-workspace/PHASE-1-PLAN.md §4): the
 * five stages with planned dates, a checklist per room, the payment schedule
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
 * ## Which stage a quote line's work belongs to
 *
 * A quote line carries a product name and a work code, nothing more, so the
 * rule reads those two, on the product NAME only (details are prose — "with
 * concealed wiring and panel lights" under a false ceiling would read as
 * electrical work). First match wins, in this order:
 *
 * 1. **Services** — supervision, project management, transport, freight,
 *    a design or professional fee, consultation: no checklist item and no
 *    material. There is nothing on site to tick off.
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
 * A stage that gets no line gets one standard item ("Design signed off",
 * "Handover walk-through done", "{stage} complete") in "Whole home", so every
 * stage can be finished by ticking its list.
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
import { KIND_TRACKER_KEYS, PLAN_KINDS, TRACKER_STAGES, type PlanKind } from './tracker';

export type { PlanKind } from './tracker';

/** The default name of each stage. The studio may rename; we read the kind. */
export const KIND_NAMES: Record<PlanKind, string> = {
  DESIGN: 'Design',
  CIVIL: 'Civil, electrical and plumbing',
  CARPENTRY: 'Carpentry',
  FINISH: 'Painting and finishing',
  HANDOVER: 'Handover',
};

/** The item a stage gets when no quote line falls in it. */
export const STANDARD_ITEM: Record<PlanKind, string> = {
  DESIGN: 'Design signed off',
  CIVIL: 'Civil, electrical and plumbing complete',
  CARPENTRY: 'Carpentry complete',
  FINISH: 'Painting and finishing complete',
  HANDOVER: 'Handover walk-through done',
};

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

export interface PlanItem {
  room: string;
  label: string;
  quoteLineId: string | null;
  sortOrder: number;
  /** Set only by the backfill, with its stage's `actualEnd`. */
  doneAt?: Date | null;
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

/** The stage a quote line's work belongs to, or null for a service line (no item, no material). See the rule above. */
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

/** Planned start and end of each stage, back to back from the start, the last ending on handover. */
export function stageDates(startOn: Date, totalDays: number): { kind: PlanKind; plannedStart: Date; plannedEnd: Date }[] {
  const days = splitAcross(Math.max(0, Math.round(totalDays)), kindWeights());
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
}

/** Five empty stages with their dates and default names. */
function emptyStages(startOn: Date, totalDays: number): PlanStage[] {
  return stageDates(startOn, totalDays).map((d, i) => ({ ...d, name: KIND_NAMES[d.kind], sortOrder: i, actualEnd: null, items: [] }));
}

/** Give a stage with no items its one standard item. */
function fillEmpty(stages: PlanStage[]): PlanStage[] {
  return stages.map((s) =>
    s.items.length > 0 ? s : { ...s, items: [{ room: WHOLE_HOME, label: STANDARD_ITEM[s.kind], quoteLineId: null, sortOrder: 0 }] },
  );
}

/** Signed quote → stages with each room's checklist, the payment schedule and the materials. */
export function quoteToPlan(input: QuotePlanInput): QuotePlan {
  const stages = emptyStages(input.startOn, input.totalDays);
  const byKind = new Map(stages.map((s) => [s.kind, s]));
  const materials: PlanMaterial[] = [];
  /* Two "Wardrobe" lines in one bedroom are two things to tick; number the
     second so the list says which. */
  const seen = new Map<string, number>();

  for (const line of input.lines) {
    const kind = stageForLine(line);
    if (!kind) continue;
    const room = line.room.trim() || WHOLE_HOME;
    const product = line.product.trim() || 'Item';
    const key = `${kind}|${room.toLowerCase()}|${product.toLowerCase()}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    const stage = byKind.get(kind)!;
    stage.items.push({ room, label: n === 1 ? product : `${product} (${n})`, quoteLineId: line.id, sortOrder: stage.items.length });
    if (kind === 'CIVIL' || kind === 'CARPENTRY' || kind === 'FINISH') {
      materials.push({ room, item: product, spec: line.details?.trim() || null, quoteLineId: line.id, sortOrder: materials.length });
    }
  }

  return { stages: fillEmpty(stages), payments: paymentSchedule(input.contractPaise, input.stages), materials };
}

/**
 * The plan of a project that has no signed quote to read (a tracker ops
 * started by hand): the five stages and their standard items, with the
 * stages the old tracker had ticked carried over as done.
 */
export function trackerToPlan(input: { startOn: Date; totalDays: number; doneStages: string[] }, now: Date): PlanStage[] {
  return carryDone(fillEmpty(emptyStages(input.startOn, input.totalDays)), input.doneStages, now);
}

/**
 * Stages the old tracker had marked done (`HomeProject.doneStages`) stay
 * done in the plan: a kind is done when every old stage it covers was. When
 * it was done was never recorded, so `actualEnd` is the planned end, or
 * today if that is still ahead — never a date later than the truth could be.
 * Their items are ticked with it.
 */
export function carryDone(stages: PlanStage[], doneStages: string[], now: Date): PlanStage[] {
  return stages.map((s) => {
    const done = KIND_TRACKER_KEYS[s.kind].every((k) => doneStages.includes(k));
    if (!done) return s;
    const actualEnd = new Date(Math.min(s.plannedEnd.getTime(), now.getTime()));
    return { ...s, actualEnd, items: s.items.map((it) => ({ ...it, doneAt: actualEnd })) };
  });
}

/** Each room's checklist across the stages: rooms in the order they first appear, stage by stage. */
export function checklistByRoom(stages: Pick<PlanStage, 'kind' | 'items'>[]): { room: string; items: { kind: PlanKind; label: string }[] }[] {
  const rooms = new Map<string, { kind: PlanKind; label: string }[]>();
  for (const s of stages) {
    for (const it of s.items) {
      const list = rooms.get(it.room) ?? [];
      list.push({ kind: s.kind, label: it.label });
      rooms.set(it.room, list);
    }
  }
  return [...rooms.entries()].map(([room, items]) => ({ room, items }));
}
