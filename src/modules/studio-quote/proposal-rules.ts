/**
 * Proposing a product the master does not have (Hauspire's "Propose a NEW
 * product (not in master)", 13 Oct 2026): the rules, pure and tested.
 *
 * From the quotation builder, anybody who quotes can propose a line the
 * product master lacks. The owner and a project manager — who may change the
 * product master anyway — add it straight in; a salesperson's proposal waits
 * on /studio/products for one of them to approve (it becomes a product) or
 * reject. Either way the line goes on the quotation at once, so the client
 * conversation never waits on the approval.
 */

import type { QuoteUnitName, WorkCodeName } from './pricing';

export interface ProposalInput {
  name: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  /** Per sq ft / rft / unit, in paise. */
  ratePaise: number;
  details: string | null;
  /** The quotation room it was proposed in; filed under a product category. */
  room: string | null;
}

export type ProposalState = 'PENDING' | 'APPROVED' | 'REJECTED';

/** A proposal as it arrives from a browser, cleaned; or why it cannot be taken. */
export function cleanProposal(raw: unknown): { ok: true; value: ProposalInput } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const name = String(r.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (name.length < 2) return { ok: false, error: 'Give the new product a name.' };
  const code: WorkCodeName = r.code === 'MODULAR' ? 'MODULAR' : 'ONSITE';
  const unit: QuoteUnitName = r.unit === 'AREA' || r.unit === 'SQFT' || r.unit === 'RFT' ? r.unit : 'UNIT';
  const rate = typeof r.ratePaise === 'number' ? r.ratePaise : Number.NaN;
  if (!Number.isInteger(rate) || rate < 0 || rate >= 1e10) return { ok: false, error: 'That rate does not look right.' };
  const details = typeof r.details === 'string' && r.details.trim() ? r.details.trim().slice(0, 1000) : null;
  const room = typeof r.room === 'string' && r.room.trim() ? r.room.trim().slice(0, 80) : null;
  return { ok: true, value: { name, code, unit, ratePaise: rate, details, room } };
}

/** The product category a quotation room files under. */
export function categoryOfRoom(room: string | null | undefined): string {
  const r = String(room ?? '');
  if (/kitchen/i.test(r)) return 'Kitchen';
  if (/bed/i.test(r)) return 'Bedroom';
  if (/living|dining|foyer/i.test(r)) return 'Living';
  if (/study|office/i.test(r)) return 'Study';
  if (/bath|toilet/i.test(r)) return 'Bathroom';
  return 'Whole home';
}

/** Only a pending proposal can be approved or rejected — once. */
export function mayReview(state: string): boolean {
  return state === 'PENDING';
}

/** Is this name already a product (or a pending proposal)? Matched loosely, as the builder matches names. */
export function sameProductName(a: string, b: string): boolean {
  const squash = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  return squash(a) === squash(b) && squash(a).length > 0;
}
