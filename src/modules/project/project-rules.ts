/**
 * The tracker's rules (studio workspace Phase 3, STUDIO-WORKSPACE-BUILD.md
 * §4 and §6): when a stage is complete, when it may show done, whose delay a
 * moved date is, how late the whole project runs, and when the last payment
 * may fall due. Pure — days are 'YYYY-MM-DD' strings in India time
 * (working-days.ts) and `today` is passed in — and tested exhaustively
 * (tests/project-rules.test.ts).
 *
 * Nothing here is typed by anyone. "Carpentry · on track" and "Overall ·
 * 4 days late" are worked out from the plan, the ticks, the photos and the
 * date changes, so the studio's screen and the customer's cannot disagree.
 *
 * ## The delay rules
 *
 * - **Planned handover** is the handover as first planned: the earliest
 *   recorded `fromDate` of a handover move, or today's column if it never
 *   moved (PHASES-2-5-FOUNDATION.md: no baseline columns).
 * - **Forecast handover** is the handover's current date, pushed out by
 *   the working days the stage under way has overrun its own end date (work
 *   not finished on time pushes everything after it), or the day handover
 *   was actually done.
 * - **Overall delay** = working days from planned to forecast handover
 *   (studio calendar: Monday–Saturday and its holidays by default).
 * - **Attribution:** a handover move whose reason is `CUSTOMER_CHANGE`, or
 *   that names a late decision (`decisionId`), is the customer's. It is
 *   shown to everyone but not counted against the studio. Supplier, site
 *   condition, the studio's own and "other" are the studio's — it chose the
 *   supplier and surveyed the site. An overrun nobody explained with a move
 *   is the studio's too.
 * - So `customerDays` = the customer's handover moves, clamped to the delay
 *   there is, and `studioDays` = the rest. Moving handover earlier for a
 *   customer reason gives the days back to the customer's side first.
 */

import { addDays, addWorkingDays, daysBetween, DEFAULT_CALENDAR, isDay, workingDaysBetween, type StudioCalendar } from './working-days';

export const STAGE_KINDS = ['DESIGN', 'CIVIL', 'CARPENTRY', 'FINISH', 'HANDOVER'] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export const DELAY_REASONS = ['SUPPLIER', 'CUSTOMER_CHANGE', 'SITE_CONDITION', 'STUDIO', 'OTHER'] as const;
export type DelayReason = (typeof DELAY_REASONS)[number];
export const isDelayReason = (v: unknown): v is DelayReason => typeof v === 'string' && (DELAY_REASONS as readonly string[]).includes(v);

export type DateField = 'PLANNED_START' | 'PLANNED_END' | 'HANDOVER';

// ── Stage completion ──────────────────────────────────────────

export interface Completion {
  done: number;
  total: number;
  open: number;
  /** Every item ticked. A stage with no items is never complete by ticks; it is marked done by hand. */
  complete: boolean;
}

export function stageCompletion(items: readonly { done: boolean }[]): Completion {
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, open: items.length - done, complete: items.length > 0 && done === items.length };
}

export type DoneGate = { ok: true } | { ok: false; why: 'no-photo' | 'items-open'; open: number };

/**
 * May the stage be marked done (and so show done to the customer)? Only
 * with at least one site photo posted during it (brief §6, Phase 3), and
 * with nothing on its checklist left open.
 */
export function canMarkStageDone(stage: { items: readonly { done: boolean }[]; photos: number }): DoneGate {
  const c = stageCompletion(stage.items);
  if (c.open > 0) return { ok: false, why: 'items-open', open: c.open };
  if (stage.photos < 1) return { ok: false, why: 'no-photo', open: 0 };
  return { ok: true };
}

/** What the plain words of a refused gate are, for the studio. */
export function gateWords(g: Exclude<DoneGate, { ok: true }>): string {
  return g.why === 'items-open'
    ? `${g.open} item${g.open === 1 ? ' is' : 's are'} still open on this stage. Tick ${g.open === 1 ? 'it' : 'them'} off first.`
    : 'Post at least one site photo from this stage first. A stage shows done to the customer only with a photo.';
}

/**
 * After a tick or an untick: does the stage's done-ness change? Ticking the
 * last item finishes a stage that has a photo; unticking an item reopens a
 * finished one. A stage with no items is left to the hand-marked button.
 */
export function settleStage(stage: { items: readonly { done: boolean }[]; photos: number; done: boolean }): 'mark-done' | 'reopen' | 'keep' {
  if (stage.items.length === 0) return 'keep';
  const c = stageCompletion(stage.items);
  if (!stage.done && c.complete && stage.photos >= 1) return 'mark-done';
  if (stage.done && !c.complete) return 'reopen';
  return 'keep';
}

// ── Date changes and whose delay they are ─────────────────────

export interface RuleChange {
  id?: string;
  stageId: string | null;
  field: DateField;
  from: string;
  to: string;
  reason: DelayReason;
  decisionId: string | null;
  at: Date;
}

export interface RuleStage {
  id: string;
  kind: StageKind;
  name: string;
  plannedStart: string;
  plannedEnd: string;
  /** The day the stage was finished; null while open. */
  actualEnd: string | null;
}

/** A late decision, or a change the customer asked for: shown, never counted against the studio. */
export const isCustomerDelay = (c: { reason: DelayReason; decisionId: string | null }): boolean =>
  c.reason === 'CUSTOMER_CHANGE' || c.decisionId !== null;

/** The handover stage: the last of kind HANDOVER, else the last stage. */
export function handoverStage<S extends { kind: StageKind }>(stages: readonly S[]): S | null {
  for (let i = stages.length - 1; i >= 0; i--) if (stages[i]!.kind === 'HANDOVER') return stages[i]!;
  return stages[stages.length - 1] ?? null;
}

/** Whether a change moved a stage's end (for the handover stage, its end is the handover). */
function movesEndOf(c: RuleChange, stage: RuleStage, isHandover: boolean): boolean {
  if (c.stageId !== stage.id && !(isHandover && c.field === 'HANDOVER' && c.stageId === null)) return false;
  return c.field === 'PLANNED_END' || (isHandover && c.field === 'HANDOVER');
}

const byAt = (a: RuleChange, b: RuleChange) => a.at.getTime() - b.at.getTime();

/** A stage's end as first planned: the earliest recorded move's `from`, else its column. */
export function originalEnd(stage: RuleStage, changes: readonly RuleChange[], isHandover = false): string {
  const first = changes.filter((c) => movesEndOf(c, stage, isHandover)).sort(byAt)[0];
  return first?.from ?? stage.plannedEnd;
}

/** The end-moves of one stage, oldest first. */
export function endMovesOf(stage: RuleStage, changes: readonly RuleChange[], isHandover = false): RuleChange[] {
  return changes.filter((c) => movesEndOf(c, stage, isHandover)).sort(byAt);
}

// ── Where each stage stands ───────────────────────────────────

export type StageState = 'done' | 'now' | 'next' | 'later';
export type StageStatusName = 'done' | 'on-track' | 'late' | 'upcoming';

export interface StageStatus {
  id: string;
  kind: StageKind;
  name: string;
  state: StageState;
  status: StageStatusName;
  plannedStart: string;
  plannedEnd: string;
  /** The end as first planned, before any move. */
  originalEnd: string;
  actualEnd: string | null;
  /** The finished day, or the day it is now expected to finish. */
  forecastEnd: string;
  /** Working days late: a finished stage against its original end; the one under way against its current end. */
  lateDays: number;
  /** Working days a finished stage beat its original end by. */
  earlyDays: number;
  /** The latest move of its end, if any. */
  lastMove: RuleChange | null;
}

/** Working days the stage under way has run past its own end date, as of today. 0 when on time or nothing is under way. */
export function overrunDays(stages: readonly RuleStage[], today: string, cal: StudioCalendar = DEFAULT_CALENDAR): number {
  const running = stages.find((s) => s.actualEnd === null);
  if (!running || daysBetween(running.plannedEnd, today) <= 0) return 0;
  return Math.max(0, workingDaysBetween(running.plannedEnd, today, cal));
}

/**
 * Every stage's state and status, in plan order. Done means finished
 * (`actualEnd`), never that a date passed. The first open stage is "now",
 * the one after it "next".
 */
export function stageStatuses(
  stages: readonly RuleStage[],
  changes: readonly RuleChange[],
  today: string,
  cal: StudioCalendar = DEFAULT_CALENDAR,
): StageStatus[] {
  const firstOpen = stages.findIndex((s) => s.actualEnd === null);
  const overrun = overrunDays(stages, today, cal);
  const handover = handoverStage(stages);
  return stages.map((s, i) => {
    const isHandover = s === handover;
    const original = originalEnd(s, changes, isHandover);
    const moves = endMovesOf(s, changes, isHandover);
    const lastMove = moves[moves.length - 1] ?? null;
    const state: StageState = s.actualEnd !== null ? 'done' : i === firstOpen ? 'now' : i === firstOpen + 1 ? 'next' : 'later';
    const base = { id: s.id, kind: s.kind, name: s.name, state, plannedStart: s.plannedStart, plannedEnd: s.plannedEnd, originalEnd: original, actualEnd: s.actualEnd, lastMove };
    if (s.actualEnd !== null) {
      const diff = workingDaysBetween(original, s.actualEnd, cal);
      return { ...base, status: 'done', forecastEnd: s.actualEnd, lateDays: Math.max(0, diff), earlyDays: Math.max(0, -diff) };
    }
    if (state === 'now') {
      const late = overrun > 0;
      return { ...base, status: late ? 'late' : 'on-track', forecastEnd: late ? today : s.plannedEnd, lateDays: overrun, earlyDays: 0 };
    }
    return { ...base, status: 'upcoming', forecastEnd: overrun > 0 ? addWorkingDays(s.plannedEnd, overrun, cal) : s.plannedEnd, lateDays: 0, earlyDays: 0 };
  });
}

/** "Carpentry · on track": the stage under way, or null once everything is done. */
export function currentStatus(statuses: readonly StageStatus[]): { id: string; kind: StageKind; name: string; status: 'on-track' | 'late'; lateDays: number } | null {
  const s = statuses.find((x) => x.state === 'now');
  if (!s) return null;
  return { id: s.id, kind: s.kind, name: s.name, status: s.status === 'late' ? 'late' : 'on-track', lateDays: s.lateDays };
}

// ── The whole project ─────────────────────────────────────────

export interface OverallDelay {
  /** Handover as first planned; null with no plan. */
  plannedHandover: string | null;
  /** Handover as now expected (or done). */
  forecastHandover: string | null;
  handedOver: boolean;
  /** Working days late in all: what "Overall · n days late" says. */
  lateDays: number;
  earlyDays: number;
  /** Of `lateDays`, the customer's (their changes, their late decisions): shown, not counted against the studio. */
  customerDays: number;
  /** Of `lateDays`, the studio's: what counts against it. */
  studioDays: number;
  /** Of `studioDays`, the overrun of the stage under way that no move explains yet. */
  overrunDays: number;
}

const NONE: OverallDelay = { plannedHandover: null, forecastHandover: null, handedOver: false, lateDays: 0, earlyDays: 0, customerDays: 0, studioDays: 0, overrunDays: 0 };

/** Planned handover against forecast handover, and whose days the difference is. See the header. */
export function overallDelay(
  stages: readonly RuleStage[],
  changes: readonly RuleChange[],
  today: string,
  cal: StudioCalendar = DEFAULT_CALENDAR,
): OverallDelay {
  const h = handoverStage(stages);
  if (!h) return NONE;
  const planned = originalEnd(h, changes, true);
  const handedOver = h.actualEnd !== null;
  const overrun = handedOver ? 0 : overrunDays(stages, today, cal);
  const forecast = handedOver ? h.actualEnd! : overrun > 0 ? addWorkingDays(h.plannedEnd, overrun, cal) : h.plannedEnd;
  const total = workingDaysBetween(planned, forecast, cal);
  const lateDays = Math.max(0, total);
  const customerMoved = endMovesOf(h, changes, true)
    .filter(isCustomerDelay)
    .reduce((sum, c) => sum + workingDaysBetween(c.from, c.to, cal), 0);
  const customerDays = Math.min(lateDays, Math.max(0, customerMoved));
  return {
    plannedHandover: planned,
    forecastHandover: forecast,
    handedOver,
    lateDays,
    earlyDays: Math.max(0, -total),
    customerDays,
    studioDays: lateDays - customerDays,
    overrunDays: Math.min(overrun, lateDays - customerDays),
  };
}

// ── Moving a date ─────────────────────────────────────────────

export interface MoveRequest {
  stageId: string;
  /** Which of the stage's dates. For the handover stage an end move is recorded as `HANDOVER`. */
  field: 'PLANNED_START' | 'PLANNED_END';
  to: string;
  reason: unknown;
  /** Move every later stage by the same number of days (an end move only). */
  shiftLater: boolean;
}

export interface MovePlan {
  /** One row per date that changes, the asked-for one first. */
  rows: { stageId: string; field: DateField; from: string; to: string }[];
  /** The new dates per stage. */
  stages: { stageId: string; plannedStart: string; plannedEnd: string }[];
  /** Calendar days the asked-for date moved (negative = earlier). */
  days: number;
}

export type MoveResult = { ok: true; plan: MovePlan } | { ok: false; error: string };

/**
 * Works out every date a move changes, or why it cannot be made, in words
 * a studio PM reads. A reason is required: it decides whose delay it is.
 */
export function planMove(stages: readonly RuleStage[], req: MoveRequest): MoveResult {
  if (!isDelayReason(req.reason)) return { ok: false, error: 'Pick why the date is moving. It decides whose delay it is.' };
  if (!isDay(req.to)) return { ok: false, error: 'Pick the new date.' };
  const i = stages.findIndex((s) => s.id === req.stageId);
  if (i < 0) return { ok: false, error: 'That stage is not on this plan any more. Reload the page.' };
  const s = stages[i]!;
  const handover = handoverStage(stages);
  if (req.field === 'PLANNED_START') {
    if (req.to === s.plannedStart) return { ok: false, error: 'That is already its start date.' };
    if (daysBetween(req.to, s.plannedEnd) < 0) return { ok: false, error: `${s.name} cannot start after it ends. Move its end date first.` };
    return {
      ok: true,
      plan: {
        rows: [{ stageId: s.id, field: 'PLANNED_START', from: s.plannedStart, to: req.to }],
        stages: [{ stageId: s.id, plannedStart: req.to, plannedEnd: s.plannedEnd }],
        days: daysBetween(s.plannedStart, req.to),
      },
    };
  }
  if (req.to === s.plannedEnd) return { ok: false, error: 'That is already its end date.' };
  if (daysBetween(s.plannedStart, req.to) < 0) return { ok: false, error: `${s.name} cannot end before it starts. Move its start date first.` };
  const days = daysBetween(s.plannedEnd, req.to);
  const endField = (x: RuleStage): DateField => (x === handover ? 'HANDOVER' : 'PLANNED_END');
  const rows: MovePlan['rows'] = [{ stageId: s.id, field: endField(s), from: s.plannedEnd, to: req.to }];
  const out: MovePlan['stages'] = [{ stageId: s.id, plannedStart: s.plannedStart, plannedEnd: req.to }];
  if (req.shiftLater) {
    for (const later of stages.slice(i + 1)) {
      if (later.actualEnd !== null) continue; // a finished stage keeps its dates
      const start = addDays(later.plannedStart, days);
      const end = addDays(later.plannedEnd, days);
      rows.push({ stageId: later.id, field: 'PLANNED_START', from: later.plannedStart, to: start });
      rows.push({ stageId: later.id, field: endField(later), from: later.plannedEnd, to: end });
      out.push({ stageId: later.id, plannedStart: start, plannedEnd: end });
    }
  }
  return { ok: true, plan: { rows, stages: out, days } };
}

// ── What the customer reads ───────────────────────────────────

/** The studio's names for the reasons (the Move a date picker). */
export const REASON_LABEL: Record<DelayReason, string> = {
  SUPPLIER: 'Supplier delay',
  CUSTOMER_CHANGE: 'Customer change',
  SITE_CONDITION: 'Site condition',
  STUDIO: 'Our delay',
  OTHER: 'Other',
};

/**
 * The reason in the customer's plain words. Never the PM's own note: that
 * is internal (brief §5). A move tied to a decision says so.
 */
export function reasonWords(c: { reason: DelayReason; decisionId: string | null }): string {
  if (c.decisionId !== null) return 'waiting on your decision';
  switch (c.reason) {
    case 'SUPPLIER':
      return 'a supplier delivered late';
    case 'CUSTOMER_CHANGE':
      return 'a change you asked for';
    case 'SITE_CONDITION':
      return 'something on site needed extra work';
    case 'STUDIO':
      return "the studio's own delay";
    case 'OTHER':
      return 'the studio rescheduled the work';
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "18 Dec" for a day. */
export function dayWords(day: string): string {
  const [, m, d] = day.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/**
 * The one sentence the customer reads for a move, e.g. "Carpentry now ends
 * 5 Nov (was 31 Oct): a supplier delivered late." Shown to the studio,
 * before it saves, exactly as the customer will read it.
 */
export function moveSentence(m: {
  stageName: string;
  field: DateField;
  from: string;
  to: string;
  reason: DelayReason;
  decisionId: string | null;
  handoverTo?: string | null;
}): string {
  const what =
    m.field === 'HANDOVER'
      ? `Handover is now ${dayWords(m.to)}`
      : m.field === 'PLANNED_START'
        ? `${m.stageName} now starts ${dayWords(m.to)}`
        : `${m.stageName} now ends ${dayWords(m.to)}`;
  const tail = m.handoverTo && m.field !== 'HANDOVER' ? ` Handover moves to ${dayWords(m.handoverTo)}.` : '';
  return `${what} (was ${dayWords(m.from)}): ${reasonWords(m)}.${tail}`;
}

// ── The last payment ──────────────────────────────────────────

/**
 * The final payment cannot fall due while any snag is open (brief §6,
 * Phase 4). Phase 4's `snag-status.ts hasOpenSnags` counts them; this says
 * what follows, in the words the studio and the customer both read.
 */
export function finalPaymentGate(openSnags: number): { canBeDue: true } | { canBeDue: false; openSnags: number; words: string } {
  if (openSnags <= 0) return { canBeDue: true };
  return { canBeDue: false, openSnags, words: `Locked until ${openSnags === 1 ? 'the open snag is' : `all ${openSnags} open snags are`} closed.` };
}
