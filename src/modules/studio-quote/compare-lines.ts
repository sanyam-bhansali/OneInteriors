/**
 * The builder's "Final (Original vs Revised)" tab, as Hauspire's app works
 * it out (`lib/compare.ts`; owner, 22 Oct 2026: the builder exactly like the
 * old one). Pure, for the builder and tests/quote-parity-builder.test.ts.
 *
 * Lines are matched on room + product name (trimmed, any case), the n-th
 * line of a pair with the n-th; a current line with no match is NEW, an
 * original line with none is REMOVED, and a matched pair is CHANGED when its
 * amount, its size text or its work code differs. Rows come in the current
 * order, removed lines after. The printable Final PDF (`final-doc.ts`) is
 * richer, by the owner's team's wish of 15 Oct; this is the old tab.
 */

import type { QuoteUnitName, WorkCodeName } from './pricing';

export type ChangeStatus = 'added' | 'removed' | 'changed' | 'same';

export interface CompareLine {
  room: string;
  product: string;
  code: WorkCodeName;
  unit: QuoteUnitName;
  widthMm: number | null;
  heightMm: number | null;
  qtyMilli: number | null;
  amountPaise: number;
  /** The line's description, shown under its name (walkthrough, 27 Oct 2026: "it doesn't show the description"). Never part of the match. */
  details?: string | null;
}

export interface CompareRow<L extends CompareLine = CompareLine> {
  room: string;
  product: string;
  o: L | null;
  c: L | null;
  status: ChangeStatus;
}

const qty = (milli: number) => String(milli / 1000);

/** The old app's `sizeText`: "120 sqft", "12 rft", "3 unit", "1800×2100", or "—". */
export function sizeText(l: CompareLine | null): string {
  if (!l) return '—';
  if (l.unit === 'SQFT' && l.qtyMilli != null) return `${qty(l.qtyMilli)} sqft`;
  if (l.unit === 'RFT' && l.qtyMilli != null) return `${qty(l.qtyMilli)} rft`;
  if (l.unit === 'UNIT' && l.qtyMilli != null && l.widthMm == null) return `${qty(l.qtyMilli)} unit`;
  if (l.widthMm || l.heightMm) return `${l.widthMm ?? '—'}×${l.heightMm ?? '—'}`;
  return '—';
}

export function compareLines<L extends CompareLine>(original: readonly L[], current: readonly L[]): CompareRow<L>[] {
  const key = (l: L) => `${l.room}||${l.product.trim().toLowerCase()}`;
  const byKey = new Map<string, L[]>();
  for (const l of original) {
    const k = key(l);
    byKey.set(k, [...(byKey.get(k) ?? []), l]);
  }
  const used = new Map<string, number>();
  const rows: CompareRow<L>[] = [];
  for (const l of current) {
    const k = key(l);
    const i = used.get(k) ?? 0;
    const o = byKey.get(k)?.[i] ?? null;
    used.set(k, i + 1);
    const status: ChangeStatus = !o ? 'added' : o.amountPaise !== l.amountPaise || sizeText(o) !== sizeText(l) || o.code !== l.code ? 'changed' : 'same';
    rows.push({ room: l.room, product: l.product, o, c: l, status });
  }
  for (const [k, list] of byKey) {
    for (let i = used.get(k) ?? 0; i < list.length; i++) {
      const o = list[i]!;
      rows.push({ room: o.room, product: o.product, o, c: null, status: 'removed' });
    }
  }
  return rows;
}
