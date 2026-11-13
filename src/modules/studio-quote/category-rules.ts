/**
 * Essential, Premium or Luxe on every quotation (owner, 13 Nov 2026):
 * "Essential / Premium / Luxe must be ticked when we make a quotation. Make
 * it mandatory. If it is not there, you cannot make a quotation." The
 * category sets how long the design takes (Premium the base, Essential half,
 * Luxe 30% more), so a quotation without one cannot go further.
 *
 * Pure and tested (tests/studio-quote-category.test.ts). Where it is checked:
 * - New quotation asks for it up front (quotations/actions.ts createQuoteAction);
 * - sending, sending again (a new revision), marking won, marking the sales
 *   final, copying, booking and Convert refuse without it;
 * - once picked it cannot be cleared, only changed.
 * Older quotations without one stay readable; the team picks one by hand.
 * Additional-scope quotations are add-ons to a project that already has its
 * category, so they are not asked.
 */

export const QUOTE_CATEGORIES = ['ESSENTIAL', 'PREMIUM', 'LUXURY'] as const;
export type QuoteCategory = (typeof QUOTE_CATEGORIES)[number];

/** The words the team uses (BudgetTier LUXURY reads "Luxe"). */
export const CATEGORY_WORDS: Record<QuoteCategory, string> = { ESSENTIAL: 'Essential', PREMIUM: 'Premium', LUXURY: 'Luxe' };

export const CATEGORY_ERRORS = {
  /** On New quotation. */
  pick: 'Pick Essential, Premium or Luxe. Every quotation needs one.',
  /** On an existing quotation that has none (send, revise, sales final, copy, booking, Convert). */
  missing: 'Pick Essential, Premium or Luxe at the top of this quotation first. It sets how long the design takes.',
  /** Trying to clear it. */
  clear: 'Every quotation needs Essential, Premium or Luxe. You can change it, not remove it.',
} as const;

/** The category from a form or a call, or null when it is not one. */
export function asQuoteCategory(raw: unknown): QuoteCategory | null {
  return typeof raw === 'string' && (QUOTE_CATEGORIES as readonly string[]).includes(raw) ? (raw as QuoteCategory) : null;
}

/** Why this quotation cannot go further without a category, or null when it can. */
export function categoryRefusal(q: { category: string | null | undefined; scopeForProjectId?: string | null }): string | null {
  if (q.scopeForProjectId) return null;
  return asQuoteCategory(q.category) ? null : CATEGORY_ERRORS.missing;
}
