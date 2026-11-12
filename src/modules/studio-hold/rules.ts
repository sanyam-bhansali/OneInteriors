/**
 * A project on hold (owner, 12 Nov 2026: "if the client ghosts or needs time
 * or possession is late we can mark a project on hold which designers will
 * have an option of apply for hold and design head approves the hold so then
 * the date from the hold is not calculated as delay and the deadlines and
 * timelines reset accordingly from the day it is removed from hold").
 *
 * Owner's choices (12 Nov 2026): the design head or the owner approves; the
 * whole project holds (design or execution); the client sees "on hold" and
 * the reason in plain words; the one who asked, the design head or the
 * owner takes it off. Pure: days are 'YYYY-MM-DD'. Tested in
 * tests/project-hold.test.ts.
 */

import { addDays, daysBetween, isDay } from '@/modules/project/working-days';
import { planMove, type MovePlan, type RuleStage } from '@/modules/project/project-rules';

export const HOLD_REASONS = {
  CLIENT_NOT_RESPONDING: 'Client not responding',
  CLIENT_NEEDS_TIME: 'Client needs time',
  POSSESSION_LATE: 'Possession is late',
  OTHER: 'Other (client side)',
  /* Automatic (owner, 12 Nov 2026): from the client's approval of additional scope until its payment is recorded. Never asked by hand. */
  ADDITIONAL_SCOPE: 'Additional scope payment pending',
} as const;
export type HoldReason = keyof typeof HOLD_REASONS;
export const isHoldReason = (v: unknown): v is HoldReason => typeof v === 'string' && v in HOLD_REASONS;

/** What the client reads, after "On hold since 12 Nov:". Polite, never the team's note. */
export const CUSTOMER_HOLD_WORDS: Record<HoldReason, string> = {
  CLIENT_NOT_RESPONDING: 'waiting to hear from you',
  CLIENT_NEEDS_TIME: 'paused while you take the time you need',
  POSSESSION_LATE: 'waiting for possession of your flat',
  OTHER: 'paused on your side',
  ADDITIONAL_SCOPE: 'waiting for the additional scope payment',
};

export type HoldStatus = 'ASKED' | 'ON' | 'ENDED' | 'DECLINED' | 'WITHDRAWN';
export const HOLD_NOTE_MAX = 500;

export interface HoldRow {
  id: string;
  status: string;
  reason: string;
  askedById: string;
  startedOn: string | null;
  endedOn: string | null;
}

/** The open hold, asked or on; null when the project is running. */
export function openHold<T extends Pick<HoldRow, 'status'>>(holds: readonly T[]): T | null {
  return holds.find((h) => h.status === 'ASKED' || h.status === 'ON') ?? null;
}

/** Is the project on hold (approved, not ended)? */
export const isOnHold = (holds: readonly Pick<HoldRow, 'status'>[]): boolean => holds.some((h) => h.status === 'ON');

/** Who approves (or declines) a hold: the owner, or the design head. */
export function mayApproveHold(m: { role: string; designHead?: boolean | null }): boolean {
  return m.role === 'OWNER' || (m.role === 'DESIGNER' && m.designHead === true);
}

/** Who takes a hold off: the one who asked it, or an approver. */
export function mayEndHold(m: { role: string; designHead?: boolean | null; userId: string }, hold: Pick<HoldRow, 'askedById'>): boolean {
  return mayApproveHold(m) || m.userId === hold.askedById;
}

export function checkHoldAsk(input: { reason: unknown; note: unknown }, holds: readonly Pick<HoldRow, 'status'>[]): { ok: true; reason: HoldReason; note: string | null } | { ok: false; error: string } {
  const open = openHold(holds);
  if (open) return { ok: false, error: open.status === 'ON' ? 'This project is on hold already.' : 'A hold is waiting for approval already.' };
  if (!isHoldReason(input.reason) || input.reason === 'ADDITIONAL_SCOPE') return { ok: false, error: 'Pick why the project should go on hold.' };
  const note = typeof input.note === 'string' ? input.note.replace(/\r\n/g, '\n').trim() : '';
  if (note.length > HOLD_NOTE_MAX) return { ok: false, error: `Keep the note under ${HOLD_NOTE_MAX} characters.` };
  return { ok: true, reason: input.reason, note: note || null };
}

/** Days a hold has been (or was) on: from its first day to the day it ends (or today). Never negative. */
export function holdDays(startedOn: string | null, endedOn: string | null, today: string): number {
  if (!startedOn || !isDay(startedOn)) return 0;
  const end = endedOn && isDay(endedOn) ? endedOn : today;
  return Math.max(0, daysBetween(startedOn, end));
}

/** Days of every ended hold plus the one on now: the client's waiting, never ours. */
export function totalHoldDays(holds: readonly Pick<HoldRow, 'status' | 'startedOn' | 'endedOn'>[], today: string): number {
  return holds.filter((h) => h.status === 'ON' || h.status === 'ENDED').reduce((sum, h) => sum + holdDays(h.startedOn, h.endedOn, today), 0);
}

export interface HoldStep {
  id: string;
  stageId: string;
  plannedOn: string | null;
  done: boolean;
}

export interface HoldShift {
  days: number;
  /** Open steps of the stage under way, moved by exactly the hold's days. */
  steps: { id: string; from: string; to: string }[];
  /** The stage under way's end and every later stage (handover included); null when no stage is open. */
  plan: MovePlan | null;
}

/**
 * The plan after a hold of `days` is taken off: the stage under way ends that
 * much later and every later stage moves by the same days (filed as the
 * client's change, so it is never counted as our delay); every open step
 * with a day in the stage under way moves by exactly the days (a later
 * stage's steps move with their stage). Done steps and finished stages never
 * move. Nothing when the hold lasted no days.
 */
export function holdEndShift(stages: readonly RuleStage[], steps: readonly HoldStep[], days: number): HoldShift {
  if (days <= 0) return { days: 0, steps: [], plan: null };
  const current = stages.find((s) => s.actualEnd === null) ?? null;
  if (!current) return { days, steps: [], plan: null };
  const moved = steps.filter((s) => s.stageId === current.id && !s.done && s.plannedOn).map((s) => ({ id: s.id, from: s.plannedOn!, to: addDays(s.plannedOn!, days) }));
  const r = planMove(stages, { stageId: current.id, field: 'PLANNED_END', to: addDays(current.plannedEnd, days), reason: 'CUSTOMER_CHANGE', shiftLater: true });
  return { days, steps: moved, plan: r.ok ? r.plan : null };
}

/** What crosses to the customer about holds: the one on now (since when, how long, why in plain words) and every hold's days. Never the note or who asked. */
export interface CustomerHold {
  since: string;
  days: number;
  /** The reason's key, for the phone app's own words in Hindi and Marathi. */
  reason: HoldReason;
  words: string;
}

export function toCustomerHold(holds: readonly { status: string; reason: string; startedOn: string | null; endedOn: string | null }[], today: string): { now: CustomerHold | null; totalDays: number } {
  const on = holds.find((h) => h.status === 'ON' && h.startedOn);
  return {
    now: on ? { since: on.startedOn!, days: holdDays(on.startedOn, null, today), reason: isHoldReason(on.reason) ? on.reason : 'OTHER', words: CUSTOMER_HOLD_WORDS[isHoldReason(on.reason) ? on.reason : 'OTHER'] } : null,
    totalDays: totalHoldDays(holds, today),
  };
}
