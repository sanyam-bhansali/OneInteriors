/**
 * How leads come in, and how the bin empties (Studio OS Phase 1,
 * docs/studio-os/PHASE-1-SALES.md §6 and §8). Pure, and tested
 * (tests/studio-sales-intake.test.ts).
 */

import { BIN_DAYS } from '@/modules/studio-practice/vocabulary';

// ── The website form: one person, one lead ─────────────────────

export interface PhoneMatch {
  id: string;
  deletedAt: Date | null;
  isDemo: boolean;
}

export type FormLanding = { kind: 'attach'; id: string } | { kind: 'create' };

/**
 * Somebody filled in the studio's form. If a lead with this phone is already
 * on the board, the enquiry is added to that lead's timeline rather than
 * making a second card (two people ringing one customer from two cards is
 * the thing this prevents). A lead in the bin does not count: the studio
 * threw it away, and the new enquiry starts fresh in the pool.
 */
export function formLanding(matches: readonly PhoneMatch[]): FormLanding {
  const live = matches.find((m) => m.deletedAt === null && !m.isDemo);
  return live ? { kind: 'attach', id: live.id } : { kind: 'create' };
}

/** The timeline line when an existing lead fills in the form again. */
export function formAgainSummary(message: string | null): string {
  const said = message?.trim();
  return `Filled in your enquiry form again${said ? `: “${said.slice(0, 300)}”` : ''}`;
}

// ── The bin really empties ─────────────────────────────────────

/** Leads deleted before this instant are erased by the daily purge. */
export function purgeCutoff(now: Date, days = BIN_DAYS): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/** Whether a deleted lead is past its thirty days. The bin promises "erased after 30 days". */
export function isPurgeable(deletedAt: Date | null, now: Date, days = BIN_DAYS): boolean {
  return deletedAt !== null && deletedAt.getTime() <= purgeCutoff(now, days).getTime();
}

// ── Import: the source, and the studio's own fields ────────────

/** A column mapped to one of the studio's own fields: `custom:<key>`. */
export const CUSTOM_PREFIX = 'custom:';

export const isCustomColumn = (key: string): boolean => key.startsWith(CUSTOM_PREFIX) && key.length > CUSTOM_PREFIX.length;

export const customKeyOf = (key: string): string => key.slice(CUSTOM_PREFIX.length);
