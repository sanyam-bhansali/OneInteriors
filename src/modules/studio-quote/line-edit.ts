/**
 * Editing a line in the builder, as Hauspire's own table edits it (its
 * `QuoteTable.tsx` `setField`; owner, 22 Oct 2026: the builder works exactly
 * like the old app). Pure, for the builder and tests/quote-parity-builder.test.ts.
 *
 * The old table re-prices a line when its size changes and it has a price to
 * re-price from — W × H with a rate and both sides filled, a square-foot or
 * running-foot line with a rate, a unit line with a unit price — and that
 * re-pricing writes over any amount typed on it before. A line with no rate
 * (the "+ add item" row, an amount typed on its own) keeps its amount
 * whatever size is typed on it. Here the typed amount is `agreedPaise`, so
 * "re-price" means letting it go.
 */

import type { QuoteUnitName } from './pricing';

export interface SizedLine {
  unit: QuoteUnitName;
  ratePaise: number;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  agreedPaise: number | null;
}

export function withRepricing<T extends SizedLine>(line: T, patch: Partial<T>): T {
  const next = { ...line, ...patch };
  if ('agreedPaise' in patch || next.agreedPaise == null || next.ratePaise <= 0) return next;
  const sides = 'widthMm' in patch || 'heightMm' in patch;
  const qty = 'qtyMilli' in patch;
  const reprice = next.unit === 'AREA' ? sides && Boolean(next.widthMm) && Boolean(next.heightMm) : qty && next.qtyMilli != null;
  return reprice ? { ...next, agreedPaise: null } : next;
}
