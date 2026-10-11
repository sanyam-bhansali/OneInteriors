/**
 * A snag's status, computed from its append-only `HomeSnagEvent` rows
 * (STUDIO-WORKSPACE-BUILD.md §4 and Phase 4; PHASES-2-5-FOUNDATION.md §5).
 * Pure, no database: tests/snag-status.test.ts covers every transition.
 *
 * ## The life of a snag
 *
 * ```
 * RAISED ─▶ ACCEPTED (fix-by + who) ─▶ FIXED (after photo) ─▶ CONFIRMED  (customer: closed)
 *    │          ▲   │                      │   │
 *    │          │   └─▶ DISPUTED ──────────┘   ├─▶ REOPENED (customer: not fixed) ─▶ ACCEPTED / FIXED again
 *    └──────────┴──────────▲                   └─▶ AUTO_CLOSED (7 days, no answer)
 * ```
 *
 * - **Only the customer closes.** The studio's FIXED leaves the snag open,
 *   waiting for the customer's CONFIRMED (or REOPENED). Seven days after the
 *   fix with no answer it is closed anyway (AUTO_CLOSED, actor SYSTEM, and
 *   the customer is told). `snagStatus(events, now)` already treats an
 *   unanswered fix older than seven days as closed, so nothing depends on
 *   when the cron runs.
 * - A DISPUTED snag (the studio says it is not a defect, with a reason the
 *   customer reads) stays open: the customer can agree and close it
 *   (CONFIRMED), the studio can still accept or fix it, and until one of
 *   those happens it holds the final payment like any open snag.
 * - Accepting again moves the fix-by date or the assignee; the latest
 *   ACCEPTED is the current one.
 *
 * ## Ordering
 *
 * By `at`, ties broken by kind (RAISED < ACCEPTED < DISPUTED < FIXED <
 * CONFIRMED = REOPENED < AUTO_CLOSED) — the backfill spaced its rows 1–2 ms
 * apart, but two rows can still share a millisecond.
 */

export type SnagEventKind = 'RAISED' | 'ACCEPTED' | 'DISPUTED' | 'FIXED' | 'CONFIRMED' | 'REOPENED' | 'AUTO_CLOSED';

export const SNAG_EVENT_KINDS: readonly SnagEventKind[] = ['RAISED', 'ACCEPTED', 'DISPUTED', 'FIXED', 'CONFIRMED', 'REOPENED', 'AUTO_CLOSED'];

/** Owner's decision (11 Oct): a fix nobody answers closes after seven days. */
export const SNAG_AUTO_CLOSE_DAYS = 7;
const DAY_MS = 86_400_000;
export const SNAG_AUTO_CLOSE_MS = SNAG_AUTO_CLOSE_DAYS * DAY_MS;

/** The tie-break when two events share an instant. */
export const SNAG_KIND_ORDER: Record<SnagEventKind, number> = {
  RAISED: 0,
  ACCEPTED: 1,
  DISPUTED: 2,
  FIXED: 3,
  CONFIRMED: 4,
  REOPENED: 4,
  AUTO_CLOSED: 5,
};

/** What the rules read from an event; a `HomeSnagEvent` row fits. */
export interface SnagEventLike {
  id?: string;
  kind: SnagEventKind | string;
  at: Date;
  fixBy?: Date | null;
  assigneeId?: string | null;
  photoPaths?: string[];
  customerText?: string | null;
  note?: string | null;
}

/**
 * - `raised`: new, nobody has answered yet
 * - `accepted`: the studio took it on, with a fix-by date
 * - `disputed`: the studio says it is not a defect (with a reason)
 * - `fixed`: the studio says it is fixed; waiting for the customer
 * - `reopened`: the customer said it is not fixed
 * - `closed`: the customer confirmed, or seven days passed after a fix
 */
export type SnagState = 'raised' | 'accepted' | 'disputed' | 'fixed' | 'reopened' | 'closed';

export interface SnagStatus<E extends SnagEventLike = SnagEventLike> {
  state: SnagState;
  /** Everything but `closed`: what holds the final payment. */
  open: boolean;
  /** The latest ACCEPTED's fix-by date (null before one, or once closed it is kept for the record). */
  fixBy: Date | null;
  assigneeId: string | null;
  /** When the current fix was made (the latest FIXED, while it stands). */
  fixedAt: Date | null;
  /** The latest FIXED event while the snag is fixed or closed after it; null otherwise. */
  fix: E | null;
  /** When an unanswered fix closes by itself; null unless `fixed`. */
  autoClosesAt: Date | null;
  closedAt: Date | null;
  /** `customer` = they confirmed; `auto` = seven days passed (event written or not yet). */
  closedBy: 'customer' | 'auto' | null;
  /** The studio's dispute reason, while disputed. */
  disputeReason: string | null;
  /** The customer's latest "not fixed" reason, while reopened. */
  notFixedReason: string | null;
  /** Times the customer said "not fixed". */
  reopenCount: number;
  /** The last event, after ordering. Null for a snag with no events. */
  last: E | null;
  /** True when the seven days have passed but no AUTO_CLOSED row exists yet: the cron's work. */
  autoCloseDue: boolean;
}

const asKind = (k: string): SnagEventKind | null => ((SNAG_EVENT_KINDS as readonly string[]).includes(k) ? (k as SnagEventKind) : null);

/** Events in the order they happened (a copy; the input is not touched). */
export function orderSnagEvents<E extends SnagEventLike>(events: readonly E[]): E[] {
  return [...events].sort((a, b) => {
    const t = a.at.getTime() - b.at.getTime();
    if (t !== 0) return t;
    return (SNAG_KIND_ORDER[a.kind as SnagEventKind] ?? 9) - (SNAG_KIND_ORDER[b.kind as SnagEventKind] ?? 9);
  });
}

/**
 * Which event may follow a state. The flow module checks this before every
 * write; an event that does not fit is refused, never written.
 *
 * `null` = a snag with no events yet: only RAISED.
 */
const NEXT: Record<SnagState | 'none', readonly SnagEventKind[]> = {
  none: ['RAISED'],
  raised: ['ACCEPTED', 'DISPUTED', 'FIXED'],
  accepted: ['ACCEPTED', 'DISPUTED', 'FIXED'],
  disputed: ['ACCEPTED', 'FIXED', 'CONFIRMED'],
  fixed: ['CONFIRMED', 'REOPENED', 'AUTO_CLOSED'],
  reopened: ['ACCEPTED', 'DISPUTED', 'FIXED'],
  closed: [],
};

export function allowedNext(state: SnagState | null): readonly SnagEventKind[] {
  return NEXT[state ?? 'none'];
}

/**
 * The status from the events. Pass `now` to apply the seven-day close; leave
 * it out to read only what was written (the cron does, to find the fixes
 * whose AUTO_CLOSED row is still to write).
 *
 * Events that do not fit the flow (a CONFIRMED with no fix before it, anything
 * after a close) are skipped rather than trusted: the flow module never
 * writes them, and a bad row must not reopen or close a snag.
 */
export function snagStatus<E extends SnagEventLike>(events: readonly E[], now?: Date): SnagStatus<E> {
  /* Every snag has a RAISED row (written with it, or by the backfill). Should
     one be missing, the snag was still raised: start from there rather than
     skip everything after it. */
  let state: SnagState | null = events.length > 0 && !events.some((e) => e.kind === 'RAISED') ? 'raised' : null;
  let fixBy: Date | null = null;
  let assigneeId: string | null = null;
  let fix: E | null = null;
  let closedAt: Date | null = null;
  let closedBy: 'customer' | 'auto' | null = null;
  let disputeReason: string | null = null;
  let notFixedReason: string | null = null;
  let reopenCount = 0;
  let last: E | null = null;

  for (const e of orderSnagEvents(events)) {
    const kind = asKind(String(e.kind));
    if (!kind || !allowedNext(state).includes(kind)) continue;
    last = e;
    switch (kind) {
      case 'RAISED':
        state = 'raised';
        break;
      case 'ACCEPTED':
        state = 'accepted';
        if (e.fixBy) fixBy = e.fixBy;
        if (e.assigneeId !== undefined && e.assigneeId !== null) assigneeId = e.assigneeId;
        disputeReason = null;
        break;
      case 'DISPUTED':
        state = 'disputed';
        disputeReason = e.note?.trim() || null;
        break;
      case 'FIXED':
        state = 'fixed';
        fix = e;
        disputeReason = null;
        notFixedReason = null;
        break;
      case 'CONFIRMED':
        state = 'closed';
        closedAt = e.at;
        closedBy = 'customer';
        break;
      case 'REOPENED':
        state = 'reopened';
        fix = null;
        reopenCount += 1;
        notFixedReason = e.note?.trim() || null;
        break;
      case 'AUTO_CLOSED':
        state = 'closed';
        closedAt = e.at;
        closedBy = 'auto';
        break;
    }
  }

  // A fix with no answer, seven days on, is closed — whether or not the cron has written it yet.
  let autoCloseDue = false;
  let autoClosesAt: Date | null = null;
  if (state === 'fixed' && fix) {
    autoClosesAt = new Date(fix.at.getTime() + SNAG_AUTO_CLOSE_MS);
    if (now && now.getTime() >= autoClosesAt.getTime()) {
      autoCloseDue = true;
      state = 'closed';
      closedAt = autoClosesAt;
      closedBy = 'auto';
      autoClosesAt = null;
    }
  }

  const st: SnagState = state ?? 'raised';
  return {
    state: st,
    open: st !== 'closed',
    fixBy,
    assigneeId,
    fixedAt: fix ? fix.at : null,
    fix: st === 'fixed' || st === 'closed' ? fix : null,
    autoClosesAt,
    closedAt,
    closedBy,
    disputeReason: st === 'disputed' ? disputeReason : null,
    notFixedReason: st === 'reopened' ? notFixedReason : null,
    reopenCount,
    last,
    autoCloseDue,
  };
}

/**
 * The state the event log is in for a write: like `snagStatus` without the
 * seven-day close applied unless asked. Null for a snag with no events.
 */
export function writtenState(events: readonly SnagEventLike[]): SnagState | null {
  const ordered = orderSnagEvents(events).filter((e) => asKind(String(e.kind)));
  if (ordered.length === 0) return null;
  return snagStatus(events).state;
}

/**
 * May this event be written now? `now` matters for the customer's answer: once
 * seven days have passed after the fix, the snag is closed and only the
 * AUTO_CLOSED row (the cron's) may still be written.
 */
export function canWrite(events: readonly SnagEventLike[], kind: SnagEventKind, now: Date): boolean {
  const written = writtenState(events);
  if (!allowedNext(written).includes(kind)) return false;
  if (written !== 'fixed') return true;
  const s = snagStatus(events, now);
  if (kind === 'AUTO_CLOSED') return s.autoCloseDue;
  return !s.autoCloseDue;
}

/** What the legacy `HomeSnag.status` column holds for a state (never any other value). */
export function legacySnagStatus(state: SnagState): 'OPEN' | 'FIXED' {
  return state === 'fixed' || state === 'closed' ? 'FIXED' : 'OPEN';
}

/**
 * Events for a snag that has none (a row written before the events table, if
 * any escaped the backfill): RAISED at creation, ACCEPTED when it had a
 * fix-by, FIXED when its legacy status says so. Mirrors the migration.
 */
export function legacySnagEvents(s: {
  createdAt: Date;
  status: string;
  fixBy: Date | null;
  fixedAt: Date | null;
  fixedNote?: string | null;
  fixedPhotoPaths?: string[];
  photoPaths?: string[];
}): SnagEventLike[] {
  const out: SnagEventLike[] = [{ kind: 'RAISED', at: s.createdAt, photoPaths: s.photoPaths ?? [] }];
  if (s.fixBy) out.push({ kind: 'ACCEPTED', at: new Date(s.createdAt.getTime() + 1), fixBy: s.fixBy });
  if (s.status === 'FIXED') {
    out.push({
      kind: 'FIXED',
      at: s.fixedAt ?? new Date(s.createdAt.getTime() + 2),
      photoPaths: s.fixedPhotoPaths ?? [],
      customerText: s.fixedNote ?? null,
    });
  }
  return out;
}

/** The events to judge a snag by: its own, or the legacy reconstruction when it has none. */
export function eventsOrLegacy<E extends SnagEventLike>(
  events: readonly E[],
  legacy: Parameters<typeof legacySnagEvents>[0],
): readonly (E | SnagEventLike)[] {
  return events.length > 0 ? events : legacySnagEvents(legacy);
}

// ── The final-payment gate ─────────────────────────────────────

/** True when any snag is not closed (`now` applies the seven-day close). */
export function hasOpenSnags(eventsBySnag: readonly (readonly SnagEventLike[])[], now: Date): boolean {
  return openSnagCount(eventsBySnag, now) > 0;
}

export function openSnagCount(eventsBySnag: readonly (readonly SnagEventLike[])[], now: Date): number {
  return eventsBySnag.filter((events) => snagStatus(events, now).open).length;
}

export type FinalPaymentGate = { ok: true } | { ok: false; open: number; error: string };

/**
 * Phase 4's rule: "Final payment stage cannot be marked due while any snag is
 * open." Only the LAST stage is held; earlier stages are not about snags.
 * Pure, so Phase 5's payment code calls the same check.
 */
export function finalPaymentGate(input: {
  stageIndex: number;
  stageCount: number;
  eventsBySnag: readonly (readonly SnagEventLike[])[];
  now: Date;
}): FinalPaymentGate {
  const { stageIndex, stageCount } = input;
  if (stageCount <= 0 || stageIndex !== stageCount - 1) return { ok: true };
  const open = openSnagCount(input.eventsBySnag, input.now);
  if (open === 0) return { ok: true };
  return {
    ok: false,
    open,
    error: `The last payment can be due only once every snag is closed. ${open} snag${open === 1 ? ' is' : 's are'} still open.`,
  };
}
