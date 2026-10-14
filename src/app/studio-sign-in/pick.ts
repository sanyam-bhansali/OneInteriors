/**
 * "Who's signing in?" (the owner's UI handoff, StudioSignIn / StudioSignInWeb).
 *
 * The role a person picks on the sign-in page is a guess about themselves,
 * never a grant: where they land is always decided by the role their studio
 * owner gave them on the team list (`homeFor(member.role)`). The pick is only
 * compared with that role, so the page can say "Teakline Studio added you as
 * Designer, not Sales" instead of dropping them on a home they did not expect.
 *
 * Pure, so the rule is pinned by tests/studio-sign-in-pick.test.ts.
 */

import type { StudioRoleName } from '@/modules/studio/roles';

/** The four role cards, then "On site today?" (the supervisor's straight-to-mobile door). */
export type PickedRole = 'SALES' | 'DESIGNER' | 'PM' | 'OWNER' | 'SUPERVISOR';

export const ROLE_CARDS: readonly Exclude<PickedRole, 'SUPERVISOR'>[] = ['SALES', 'DESIGNER', 'PM', 'OWNER'];

const PICKED = new Set<string>(['SALES', 'DESIGNER', 'PM', 'OWNER', 'SUPERVISOR']);

/** A pick arriving from the browser, checked against the list; anything else is "no pick". */
export function asPicked(v: unknown): PickedRole | null {
  return typeof v === 'string' && PICKED.has(v) ? (v as PickedRole) : null;
}

/**
 * Whether the pick agrees with the team list. No pick, and the site door
 * ("On site today?", which only chooses mobile sign-in), are never a
 * mismatch — as in the design, where the check runs for the four cards only.
 * Accounts has no card, so an accounts member always hears their real role.
 */
export function roleMismatch(picked: PickedRole | null, real: StudioRoleName): boolean {
  if (picked === null || picked === 'SUPERVISOR') return false;
  return picked !== real;
}

/** Email is the default for the owner (who has the email sign-in); everyone else signs in by mobile. */
export function defaultVia(picked: PickedRole | null): 'email' | 'phone' {
  return picked === 'OWNER' ? 'email' : 'phone';
}

/** The design's step dots: role, contact, code (the welcome screen has none lit). */
export function stepDots(step: 'role' | 'contact' | 'code' | 'done'): ('on' | 'done' | '')[] {
  const order = ['role', 'contact', 'code', 'done'] as const;
  const idx = order.indexOf(step);
  return [0, 1, 2].map((i) => (i === Math.min(idx, 2) && idx < 3 ? 'on' : i < idx ? 'done' : ''));
}

/** The digits of a code as typed or pasted, at most six. */
export function codeDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}
