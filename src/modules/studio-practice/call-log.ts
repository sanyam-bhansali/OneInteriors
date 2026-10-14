/**
 * "Log call" as AxLeads does it (owner, 13 Oct 2026): pick what happened —
 * Picked up, No answer, Busy, Switched off, Voicemail, Wrong number — and a
 * call that was picked up opens a sheet of one-tap reactions, an optional
 * stage move, a note (required), how long it lasted and an optional
 * follow-up. Pure; tests/call-log.test.ts pins it.
 *
 * A picked-up call is still one of our call outcomes underneath, so the next
 * action and its time keep coming from `OUTCOME_FOLLOWUP`: "Not interested"
 * among the reactions logs `not_interested` (and clears the follow-up),
 * "Call back later" logs `busy` (they asked us to ring back), anything else
 * logs `spoke`.
 */

import type { CallOutcomeId } from './event-copy';

/** The Log call menu, in AxLeads' order. `picked_up` opens the sheet; the rest log at once. */
export const CALL_MENU = [
  { id: 'picked_up', label: 'Picked up' },
  { id: 'no_answer', label: 'No answer' },
  { id: 'line_busy', label: 'Busy' },
  { id: 'switched_off', label: 'Switched off' },
  { id: 'voicemail', label: 'Voicemail' },
  { id: 'wrong_number', label: 'Wrong number' },
] as const;

export type CallMenuId = (typeof CALL_MENU)[number]['id'];

/** What the person said, one tap each, as AxLeads lists them. */
export const CALL_REACTIONS = [
  { id: 'interested', label: 'Interested' },
  { id: 'wants_quote', label: 'Wants a quote / estimate' },
  { id: 'wants_visit', label: 'Wants a site visit' },
  { id: 'portfolio', label: 'Asked for portfolio' },
  { id: 'budget_low', label: 'Budget too low' },
  { id: 'exploring', label: 'Just exploring' },
  { id: 'possession', label: 'Possession not ready' },
  { id: 'comparing', label: 'Comparing designers' },
  { id: 'already_done', label: 'Already done' },
  { id: 'call_back', label: 'Call back later' },
  { id: 'not_interested', label: 'Not interested' },
] as const;

export type CallReactionId = (typeof CALL_REACTIONS)[number]['id'];

const REACTION_IDS = new Set<string>(CALL_REACTIONS.map((r) => r.id));

/** Reactions arriving from a form: known ones only, each once, in the list's order. */
export function cleanReactions(raw: unknown): CallReactionId[] {
  if (!Array.isArray(raw)) return [];
  const picked = new Set(raw.filter((v): v is string => typeof v === 'string' && REACTION_IDS.has(v)));
  return CALL_REACTIONS.filter((r) => picked.has(r.id)).map((r) => r.id);
}

/** Minutes on the phone: a whole number from 1 to 600, or nothing. */
export function cleanMinutes(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;
  const m = Math.round(n);
  return m >= 1 && m <= 600 ? m : null;
}

/** Which of our call outcomes a picked-up call logs, from what they said. */
export function pickedUpOutcome(reactions: readonly CallReactionId[]): CallOutcomeId {
  if (reactions.includes('not_interested')) return 'not_interested';
  if (reactions.includes('call_back')) return 'busy';
  return 'spoke';
}

/** "Interested, Wants a site visit · 6 min" for the timeline line. Empty when there is neither. */
export function reactionLine(reactions: readonly CallReactionId[], minutes: number | null): string {
  const words = reactions.map((id) => CALL_REACTIONS.find((r) => r.id === id)?.label ?? id);
  const parts = [words.join(', '), minutes ? `${minutes} min` : ''].filter(Boolean);
  return parts.join(' · ');
}

/** The sheet's footer: "Logs the call · attempt 3" (this call included). */
export function attemptLine(previousCalls: number): string {
  return `Logs the call · attempt ${Math.max(0, previousCalls) + 1}`;
}
