/**
 * When a studio may be approved onto the marketplace — the owner's rule of
 * 30 Sep 2026.
 *
 * Rates are mandatory, and they come from the studio's own quotations: a
 * studio is approved only once at least `MIN_QUOTATIONS_FOR_RATES` (50) of
 * its quotations have been read, ops has approved the rates derived from
 * them (LIVE `StudioFiledRate`s), and its product master has been filled from
 * those rates. Rates typed into the form never qualify on their own — every
 * customer quote is priced on this studio's real numbers or not at all.
 *
 * Checked at the approval itself (`setStudioStatus` → ACTIVE), and shown to
 * ops beside the button so the reason is never a surprise.
 *
 * Pure, and tested.
 */

import { MIN_QUOTATIONS_FOR_RATES } from '@/modules/quotation/catalogue';

export interface ApprovalFacts {
  /** Quotations read from archives whose rates ops has approved (state FILED). */
  quotationsRead: number;
  /** LIVE filed rates (the older route). */
  liveRates: number;
  /**
   * Ops has approved a product master read from the studio's quotations
   * (`Studio.ratesFilledAt`, product-drafts.ts) — the route since 10 Oct.
   * Optional so older callers read as not approved.
   */
  productMasterApproved?: boolean;
  /** PRICED products in the studio's own product master — a starter catalogue with blank rates is not one. */
  productMaster: number;
}

/** Why this studio cannot be approved yet — empty when it can. */
export function approvalBlockers(f: ApprovalFacts): string[] {
  const out: string[] = [];
  if (f.quotationsRead < MIN_QUOTATIONS_FOR_RATES) {
    out.push(
      `Only ${f.quotationsRead} of their quotations have been read and approved — at least ${MIN_QUOTATIONS_FOR_RATES} are needed before they can be listed.`,
    );
  }
  /* Either route counts: the product master approved on this page (the one
     price list), or live filed rates. Requiring filed rates alone would have
     refused every studio priced the new way. */
  if (f.liveRates === 0 && !f.productMasterApproved) {
    out.push('No rates are approved yet — approve the product master read from their quotations first.');
  }
  if (f.productMaster === 0) out.push('Their product master has no priced products yet — it fills when their rates are approved.');
  return out;
}

/**
 * How many quotations a studio has sent, for the onboarding step: the count
 * read from each archive where it has been read, otherwise the files sent
 * (one quotation per file until the reader says otherwise).
 */
export function quotationsSent(archives: { quotationCount: number | null; fileCount: number }[]): number {
  return archives.reduce((n, a) => n + (a.quotationCount ?? a.fileCount), 0);
}
