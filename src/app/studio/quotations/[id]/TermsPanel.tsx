'use client';

/** This quotation's terms, as the builder holds them. Rupees and percents as typed. */
export interface TermsDraft {
  /** The professional fee: 7% for every studio, on or off on this quotation. */
  feeOn: boolean;
  discountPct: string;
  gstOn: boolean;
  onSpotRupees: string;
  onSpotLabel: string;
  advanceRupees: string;
  /** YYYY-MM-DD. */
  quoteDate: string;
}

/** Percent text → basis points, or null when it is not a percentage. */
export function pctToBps(text: string): number | null {
  const n = Number(text.trim() || '0');
  if (!Number.isFinite(n) || n < 0 || n > 50) return null;
  return Math.round(n * 100);
}

/** Rupee text → paise, or null. */
export function rupeesToPaiseText(text: string): number | null {
  const n = Number(text.replace(/[,₹\s]/g, '') || '0');
  if (!Number.isFinite(n) || n < 0 || n >= 1e9) return null;
  return Math.round(n * 100);
}
