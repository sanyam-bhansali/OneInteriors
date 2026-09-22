/**
 * What each line of a timeline says.
 *
 * Pure, no `server-only` — CONTRIBUTING §9.5. The timeline renders in a client
 * component, and the writer composes its summaries on the server, so both
 * sides have to reach the same sentences.
 *
 * ## The summary is written once, at write time
 *
 * These functions are called when the event is CREATED, and the result is
 * stored in the row. They are deliberately not called again at read time.
 *
 * A stage rename is why. If the line were rendered from `meta.toStageId` on
 * every read, renaming "Quoted" to "Priced" would retroactively change what
 * the timeline says happened two years ago — and a record that edits itself
 * to match the present is not a record. "Moved to Quoted" has to keep saying
 * Quoted.
 *
 * The same argument applies to a member's name, which is why `byName` is a
 * column rather than a join.
 */

import type { ClientSourceName, LostReasonName } from './vocabulary';
import { SOURCE_LABELS, LOST_LABELS } from './vocabulary';

export type EventKindName =
  | 'CREATED'
  | 'STAGE_CHANGED'
  | 'CONTACTED'
  | 'ASSIGNED'
  | 'NOTE'
  | 'QUOTED'
  | 'LOST'
  | 'BINNED'
  | 'RESTORED'
  | 'WITHDRAWN';

/**
 * How a lead got here. Not the `ClientSource` enum.
 *
 * `ClientSource` answers "where did this person come from" — Instagram, a
 * referral, us. This answers "how did the row appear" — somebody typed it, a
 * spreadsheet carried it, the introduction bridge made it. Two different
 * questions that happen to overlap on exactly one value, and collapsing them
 * would mean a CSV of Instagram leads could never say it was a CSV.
 */
export type CreatedHow = 'typed' | 'imported' | 'introduced' | 'sample';

export function createdSummary(how: CreatedHow, source: ClientSourceName): string {
  if (how === 'introduced') return 'Introduced by One Interiors, from their brief';
  if (how === 'imported') return 'Imported from a spreadsheet';
  if (how === 'sample') return 'Added as a sample, to show how the board works';
  const label = SOURCE_LABELS[source];
  /* "Added by hand" on its own is what every CRM says and tells nobody
     anything. The source is the part worth keeping. */
  return label && source !== 'OTHER' ? `Added by hand — ${label}` : 'Added by hand';
}

export function stageSummary(from: string | null, to: string): string {
  /* No "from" on the first move, which is the one that happens seconds after
     creation — "moved from Enquiry to Enquiry" is noise, and so is a line
     that explains a transition nobody made. */
  return from && from !== to ? `Moved from ${from} to ${to}` : `Moved to ${to}`;
}

/**
 * What a call produced.
 *
 * Ordered by how often it happens, not by how good it is. "No answer" is the
 * most common outcome of ringing a lead and a list that buries it under four
 * optimistic options is a list that gets misclicked.
 */
export const CALL_OUTCOMES = [
  { id: 'no_answer', label: 'No answer', logs: 'Called — no answer' },
  { id: 'spoke', label: 'Spoke to them', logs: 'Spoke to them' },
  { id: 'busy', label: 'Asked to call back', logs: 'Called — they asked us to ring back' },
  { id: 'met', label: 'Met them', logs: 'Met them' },
  { id: 'site_visit', label: 'Visited the site', logs: 'Visited the site' },
  { id: 'messaged', label: 'Messaged them', logs: 'Messaged them' },
  { id: 'not_interested', label: 'Not interested', logs: 'Spoke to them — not interested' },
] as const;

export type CallOutcomeId = (typeof CALL_OUTCOMES)[number]['id'];

export function isCallOutcome(v: string): v is CallOutcomeId {
  return CALL_OUTCOMES.some((o) => o.id === v);
}

/**
 * What the call produced, and what that means somebody has to do.
 *
 * ## Why an outcome sets the next action
 *
 * "Log a call" that only stamps a date is a diary, and a diary is a thing you
 * fill in rather than a thing that helps. The point of asking what happened
 * is that the answer decides the next move — somebody who asked for a
 * quotation needs a quotation, and the studio should not have to remember
 * that separately from recording the call.
 *
 * So every outcome carries the work it implies and when it is due, and
 * `logContact` writes both. AxLeads does the same with its call reactions,
 * and it is the single feature that makes its call log worth keeping.
 *
 * ## Why these hours
 *
 * Not a uniform 24. Somebody who asked for a quotation is comparing studios
 * this week and a day late is a lost job; somebody who said "call me after
 * Diwali" does not want to hear from you tomorrow. The deadline is the
 * promise implied by the conversation, so it varies with the conversation.
 *
 * ## Three outcomes, not two
 *
 * A `Followup` sets a task. `'clear'` REMOVES whatever task was there, which
 * is different from leaving it alone: a lead who has just said they are not
 * interested must not keep "Try them again" due tomorrow, because that task
 * is now a promise to annoy somebody. `null` would leave it standing.
 *
 * Nothing here maps to `null` today. It stays in the type because an outcome
 * that genuinely implies neither is easy to imagine — "left a voicemail"
 * while a callback is already booked — and the alternative is inventing work,
 * which is how a follow-up list fills with things nobody intends to do and
 * stops being read.
 */
export interface Followup {
  action: string;
  /** Hours from now. */
  dueInHours: number;
}

export const OUTCOME_FOLLOWUP: Record<CallOutcomeId, Followup | 'clear' | null> = {
  /* Ringing again the same hour is harassment; three days is forgetting.
     Tomorrow is the answer nobody argues with. */
  no_answer: { action: 'Try them again', dueInHours: 24 },
  spoke: { action: 'Follow up on that conversation', dueInHours: 72 },
  /* They named the terms. Honouring them the next working day is the whole
     of the promise. */
  busy: { action: 'Ring them back as agreed', dueInHours: 24 },
  met: { action: 'Send what you discussed', dueInHours: 24 },
  /* After a site visit the studio has measurements and the customer is
     waiting on a number. This is the moment a job is won or drifts. */
  site_visit: { action: 'Send the quotation', dueInHours: 48 },
  messaged: { action: 'Check whether they replied', dueInHours: 48 },
  /* Cleared, not skipped. They have said no; a task saying otherwise is a
     promise to annoy them. The stage is untouched — saying "not interested"
     on a call is not the same as marking the lead lost, and only the person
     looking at it should decide that. */
  not_interested: 'clear',
};

/** The due date an outcome implies, or null. */
export function followupDue(outcome: CallOutcomeId, now: Date = new Date()): Date | null {
  const f = OUTCOME_FOLLOWUP[outcome];
  if (!f || f === 'clear') return null;

  const due = new Date(now.getTime() + f.dueInHours * 60 * 60 * 1000);
  /* 10am, not the hour the call happened. A task due at 19:40 sorts into the
     evening of a day nobody is working, and the board orders on this. */
  due.setHours(10, 0, 0, 0);

  /* Rounding back to 10am can pull the due date into the past when the call
     was late at night — `+24h` from 23:00 is tomorrow 23:00, floored to
     tomorrow 10:00, which is still ahead. But `+0` cases and daylight edges
     are not worth reasoning about twice: if it landed behind now, push a day. */
  if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
  return due;
}

export function contactSummary(outcome: CallOutcomeId, note?: string | null): string {
  const base = CALL_OUTCOMES.find((o) => o.id === outcome)?.logs ?? 'Contacted them';
  const tidy = note?.trim();
  return tidy ? `${base} — ${tidy}` : base;
}

export function assignedSummary(toName: string | null): string {
  /* Null is the pool, and the pool has to read as a deliberate act rather
     than an absence — "returned to the pool" is a decision somebody made. */
  return toName ? `Given to ${toName}` : 'Returned to the pool — nobody is on it';
}

export function lostSummary(reason: LostReasonName | null, note?: string | null): string {
  const label = reason ? LOST_LABELS[reason] : null;
  const tidy = note?.trim();
  const head = label ? `Marked lost — ${label.toLowerCase()}` : 'Marked lost';
  return tidy ? `${head}. ${tidy}` : head;
}

/**
 * The icon and tone for a line, so the eye can skim a year of history.
 *
 * Tone is not severity. LOST is not red: losing a lead is an ordinary outcome
 * of doing the work, and a timeline that scolds a studio in red every time
 * they record one teaches them to stop recording them — which costs us the
 * one number on the analytics page that explains why.
 */
export type EventTone = 'accent' | 'good' | 'quiet';

export function toneFor(kind: EventKindName): EventTone {
  if (kind === 'QUOTED' || kind === 'CONTACTED') return 'good';
  if (kind === 'CREATED' || kind === 'STAGE_CHANGED') return 'accent';
  return 'quiet';
}

/** A short word for the kind, for the line's label. */
export const KIND_LABELS: Record<EventKindName, string> = {
  CREATED: 'Added',
  STAGE_CHANGED: 'Moved',
  CONTACTED: 'Contact',
  ASSIGNED: 'Owner',
  NOTE: 'Note',
  QUOTED: 'Quote',
  LOST: 'Lost',
  BINNED: 'Deleted',
  RESTORED: 'Restored',
  WITHDRAWN: 'Withdrawn',
};

/**
 * "3 days ago", "just now".
 *
 * Relative, because a timeline is read as a sequence and an absolute date
 * makes the reader do the arithmetic. The exact timestamp goes in a `title`
 * on the element for the one time a month somebody needs it.
 */
export function ago(then: Date, now: Date = new Date()): string {
  const secs = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}
