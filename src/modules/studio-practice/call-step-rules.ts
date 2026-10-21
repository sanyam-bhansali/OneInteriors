/**
 * Calling steps (owner, 21 Oct 2026): where a lead should go after a call,
 * as a suggestion. Pure, tested in tests/call-step-rules.test.ts.
 *
 * Hauspire's salespeople cold-call down thousands of "New" leads through
 * Calling 1 → Calling 2 → Calling 3 → Calling 4. Moving each card by hand
 * after every unanswered call is the work AxLeads made them do; doing it
 * silently is the thing the owner has ruled out ("easy, not automatic").
 * So the call sheet shows the move this file suggests, pre-ticked, and the
 * person can untick it. The server checks the same rule again before it
 * moves anything (`clients.ts logContact`).
 *
 * The rule, for a lead in an open column:
 *
 * - Any call that was not picked up (no answer, busy, switched off,
 *   voicemail), from the intake column → the first calling step.
 * - The same from calling step N → calling step N+1.
 * - The same from the LAST calling step → no move ticked; instead two
 *   one-tap closes are offered, Junk (a lost column other than the main
 *   one, when the studio has one) and Lost — no response, with "keep it
 *   here" as the default.
 * - Picked up → nothing from this rule: the Picked up sheet already asks
 *   where to put them.
 * - Wrong number → nothing from this rule: it already asks "mark lost —
 *   wrong number?".
 * - A lead in any other open column (Effective Lead, Quotation Shared…), or
 *   in a won, finished or lost one → nothing. A missed call to somebody
 *   halfway to a booking is not a reason to send them back to cold calling.
 *
 * "Don't retry" on the retry picker is the one more move this file allows:
 * a not-picked-up call can always close the lead into the main lost column
 * with "Stopped replying" (NO_RESPONSE). The person chooses it; it is never
 * ticked for them.
 */

import { mainLostStage, type LostReasonName, type StageKindName } from './vocabulary';
import type { CallOutcomeId } from './event-copy';

export interface CallStage {
  id: string;
  name: string;
  kind: StageKindName;
  sortOrder?: number;
  isIntake?: boolean;
  isCallStep?: boolean;
}

/** The calls nobody answered: these are what walk a lead down the calling steps. */
export const NOT_PICKED_UP: readonly CallOutcomeId[] = ['no_answer', 'line_busy', 'switched_off', 'voicemail'];

export function isNotPickedUp(outcome: string): boolean {
  return (NOT_PICKED_UP as readonly string[]).includes(outcome);
}

/** The reason a lead closed from the calling steps carries. */
export const NO_RESPONSE: LostReasonName = 'NO_RESPONSE';

export type CallMoveSuggestion =
  /** Nothing to suggest. */
  | { kind: 'none' }
  /** One move, shown pre-ticked: "Move to Calling 2". */
  | { kind: 'move'; to: { id: string; name: string } }
  /**
   * After the last calling step: keep it here (the default), or close it —
   * into Junk (when the studio has a second lost column) or Lost, both with
   * NO_RESPONSE.
   */
  | { kind: 'close'; keep: { id: string; name: string }; junk: { id: string; name: string } | null; lost: { id: string; name: string } | null };

const ref = (s: CallStage) => ({ id: s.id, name: s.name });
const ordered = (stages: readonly CallStage[]) =>
  stages
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.sortOrder ?? a.i) - (b.s.sortOrder ?? b.i) || a.i - b.i)
    .map(({ s }) => s);

/** The calling steps, in board order: open columns marked as one, never the intake. */
export function callSteps(stages: readonly CallStage[]): CallStage[] {
  return ordered(stages).filter((s) => s.kind === 'OPEN' && s.isCallStep === true && s.isIntake !== true);
}

/**
 * The "junk" column: a lost column that is not the one "Mark lost" uses
 * (`mainLostStage`). Hauspire's Junk. Null when the studio has only one.
 */
export function junkStage(stages: readonly CallStage[]): CallStage | null {
  const main = mainLostStage(stages);
  return ordered(stages).find((s) => s.kind === 'LOST' && s.id !== main?.id) ?? null;
}

/** What to suggest after this call, for a lead in `currentStageId`. */
export function suggestCallMove(stages: readonly CallStage[], currentStageId: string | null | undefined, outcome: string | null | undefined): CallMoveSuggestion {
  const none = { kind: 'none' } as const;
  if (!outcome || !isNotPickedUp(outcome)) return none;
  const current = stages.find((s) => s.id === currentStageId);
  if (!current || current.kind !== 'OPEN') return none;

  const steps = callSteps(stages);
  if (steps.length === 0) return none;

  const at = steps.findIndex((s) => s.id === current.id);
  if (at < 0) {
    /* Only the intake column starts the calling steps; any other open
       column is past them. */
    return current.isIntake === true ? { kind: 'move', to: ref(steps[0]!) } : none;
  }
  const next = steps[at + 1];
  if (next) return { kind: 'move', to: ref(next) };

  const lost = mainLostStage(stages);
  const junk = junkStage(stages);
  if (!lost && !junk) return none;
  return { kind: 'close', keep: ref(current), junk: junk ? ref(junk) : null, lost: lost ? ref(lost) : null };
}

/**
 * Every move a call may make, for the server to check a requested one
 * against: the suggestion's move, or one of its closes, or (for a
 * not-picked-up call from any open column) "Don't retry" into the main lost
 * column. Each with the lost reason it carries (null for an open column).
 */
export function allowedCallMoves(stages: readonly CallStage[], currentStageId: string | null | undefined, outcome: string | null | undefined): { id: string; lostReason: LostReasonName | null }[] {
  const out: { id: string; lostReason: LostReasonName | null }[] = [];
  const s = suggestCallMove(stages, currentStageId, outcome);
  if (s.kind === 'move') out.push({ id: s.to.id, lostReason: null });
  if (s.kind === 'close') {
    if (s.junk) out.push({ id: s.junk.id, lostReason: NO_RESPONSE });
    if (s.lost) out.push({ id: s.lost.id, lostReason: NO_RESPONSE });
  }
  const current = stages.find((x) => x.id === currentStageId);
  const lost = mainLostStage(stages);
  if (outcome && isNotPickedUp(outcome) && current?.kind === 'OPEN' && lost && !out.some((o) => o.id === lost.id)) {
    out.push({ id: lost.id, lostReason: NO_RESPONSE });
  }
  return out;
}

/** "Don't retry": the main lost column, for a not-picked-up call on an open lead. Null otherwise. */
export function giveUpStage(stages: readonly CallStage[], currentStageId: string | null | undefined, outcome: string | null | undefined): { id: string; name: string } | null {
  const current = stages.find((x) => x.id === currentStageId);
  if (!outcome || !isNotPickedUp(outcome) || current?.kind !== 'OPEN') return null;
  const lost = mainLostStage(stages);
  return lost ? ref(lost) : null;
}
