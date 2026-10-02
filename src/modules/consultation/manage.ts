/**
 * Moving or cancelling a booked expert call — from the link in the
 * confirmation email or from "Your home" (build queue item 2).
 *
 * A booked call with no way to move it becomes a no-show. So every booking
 * carries a private link (/call/<token>), usable without signing in because
 * the email is where people look, up to an hour before the call. Inside the
 * hour the expert may already be reading the brief, so the page asks them to
 * reply instead.
 *
 * Pure, and tested.
 */

import { randomBytes } from 'node:crypto';

/** No changes inside this many minutes of the start. */
export const CHANGE_CUTOFF_MINS = 60;

export function newManageToken(): string {
  return randomBytes(24).toString('base64url');
}

/** A token as it arrives in a URL — our shape, or nothing. */
export function cleanToken(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  return /^[A-Za-z0-9_-]{32}$/.test(t) ? t : null;
}

export type ChangeState = 'open' | 'too-late' | 'past' | 'closed';

/** Can this call still be moved or cancelled from the link? */
export function changeState(call: { status: string; scheduledFor: Date | null }, now: Date): ChangeState {
  if (call.status !== 'scheduled' || !call.scheduledFor) return 'closed';
  const minsLeft = (call.scheduledFor.getTime() - now.getTime()) / 60_000;
  if (minsLeft <= 0) return 'past';
  if (minsLeft < CHANGE_CUTOFF_MINS) return 'too-late';
  return 'open';
}
