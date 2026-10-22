/**
 * Bulk actions on the leads list (leads at scale, 12 Oct 2026). Pure, tested
 * in tests/studio-leads-scale.test.ts. The writes are in `bulk.ts`.
 *
 * Who may do what, in bulk, is the same table as one lead at a time
 * (roles.ts): owner and PM may assign, split, move, set a follow-up and bin
 * any lead; a salesperson may move and set follow-ups on their own leads
 * only (their scope already narrows the rows), and never assign or bin.
 *
 * Sales roles (owner, 22 Oct 2026): every bulk action also needs `lead.bulk`
 * ("Act on many leads at once"), and bulk.ts fences the rows by both the
 * bulk reach and the action's own reach (assign, edit), so a head with team
 * reach acts on their team's leads only.
 */

import { can, type MemberRole } from '@/modules/studio/roles';

export type BulkAction = 'claim' | 'assign' | 'split' | 'move' | 'followup' | 'bin';

export const BULK_LABELS: Record<BulkAction, string> = {
  claim: 'Claim for myself',
  assign: 'Give to one person',
  split: 'Split evenly',
  move: 'Move to a column',
  followup: 'Set a follow-up date',
  bin: 'Delete',
};

/** The most leads one bulk action touches. Above this, narrow the filters. */
export const BULK_MAX = 30_000;

/** Rows written per statement. */
export const BULK_CHUNK = 1000;

export function mayBulk(member: MemberRole, action: BulkAction): boolean {
  if (!can(member, 'lead.bulk')) return false;
  switch (action) {
    case 'claim':
      return can(member, 'lead.claim');
    case 'assign':
    case 'split':
      return can(member, 'lead.assign');
    case 'bin':
      return can(member, 'lead.delete');
    case 'move':
    case 'followup':
      // Owner and PM on any lead; a salesperson on their own (`assigned: true`
      // is what their scope guarantees for every row they can select).
      return can(member, 'lead.edit', { assigned: true });
  }
}

/** The bulk actions this person sees on the list. */
export function bulkActionsFor(member: MemberRole): BulkAction[] {
  return (['claim', 'assign', 'split', 'move', 'followup', 'bin'] as const).filter((a) => mayBulk(member, a));
}

/**
 * Deal leads out evenly, in order, one each in turn: with 10 leads and three
 * people it is 4, 3, 3, and the first person gets leads 1, 4, 7, 10. Taking
 * turns rather than cutting the list in blocks means nobody gets only the
 * oldest. Duplicate people are counted once; no people, nothing is dealt.
 */
export function splitEvenly<T>(items: readonly T[], memberIds: readonly string[]): Map<string, T[]> {
  const people = [...new Set(memberIds.filter((m) => typeof m === 'string' && m.length > 0))];
  const out = new Map<string, T[]>(people.map((p) => [p, []]));
  if (people.length === 0) return out;
  items.forEach((item, i) => out.get(people[i % people.length]!)!.push(item));
  return out;
}

/** Split a list into chunks of `size` (the last may be shorter). */
export function chunks<T>(items: readonly T[], size = BULK_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** "Done. 4 to Asha, 3 to Ravi, 3 to Meera; each has been told." */
export function splitSentence(counts: { name: string; n: number }[]): string {
  const given = counts.filter((c) => c.n > 0);
  if (given.length === 0) return 'Nothing to share out.';
  return `Done. ${given.map((c) => `${c.n} to ${c.name}`).join(', ')}; each has been told.`;
}

/** "Select the first 100 / 500 / 1,000" of what the filters show (AxLeads). */
export const SELECT_FIRST: readonly number[] = [100, 500, 1000];

/** A "first N" from a browser: a whole number from 1 to BULK_MAX, or null for "all". */
export function readLimit(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) return null;
  return Math.min(raw, BULK_MAX);
}

/**
 * Which leads a bulk action may reach, as a fence: claiming reads the pool
 * (only unassigned leads can be claimed); everything else a salesperson
 * does reaches their own leads only, whatever the filters said. `seesAll`
 * is true for anyone who sees more than their own (owner, PM, a sales role
 * with team or all reach): their rows are fenced by reach in bulk.ts instead.
 */
export function bulkFence(action: BulkAction, seesAll: boolean): 'pool' | 'mine' | 'filters' {
  if (action === 'claim') return 'pool';
  if (!seesAll) return 'mine';
  return 'filters';
}
