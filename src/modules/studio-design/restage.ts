/**
 * The payment stages on the Design Final's total (owner, 14 Nov 2026: "after
 * marking the design quotation as final it still doesn't change the payment
 * stages total"). Pure; tested in tests/design-final-restage.test.ts.
 *
 * Owner, 19 Nov 2026: "the booking amount and design advance should be
 * according to sales quotation, then design closure etc should be divided
 * according to the design final". So:
 *
 * - A stage with a fixed amount (the booking advance, `pct` null) keeps it.
 * - The design advance (the first stage with a percentage) is what it is on
 *   the sales final: its share of the sales final's total after the fixed
 *   stages. Given the sales total, it is worked out again from it, so a
 *   project restaged under the older rule is put right.
 * - The other percentage stages (design closure, procurement, dispatch,
 *   handover) share what is left of the Design Final's total by their
 *   percentages, exactly (`splitAcross`).
 *
 * Without the sales total (or with one percentage stage only), every
 * percentage stage shares the rest of the new total, as before. With no
 * percentage stages at all, the amounts are scaled to the new total.
 * Payments already recorded stay against their stage: the ledger shows the
 * new amount due on each.
 */

import { splitAcross } from '@/lib/money';

export interface Stage {
  label: string;
  pct: number | null;
  amountPaise: number;
}

export type Restage = { ok: true; stages: Stage[]; changed: boolean } | { ok: false; error: string };

export function restageOnTotal(stages: readonly Stage[], totalPaise: number, salesTotalPaise: number | null = null): Restage {
  if (!Number.isInteger(totalPaise) || totalPaise <= 0) return { ok: false, error: 'The Design Final has no total.' };
  if (stages.length === 0) return { ok: false, error: 'This project has no payment stages.' };
  const pctAt = stages.map((s, i) => (s.pct !== null && s.pct > 0 ? i : -1)).filter((i) => i >= 0);
  const before = stages.reduce((a, s) => a + s.amountPaise, 0);
  /* Without the sales total, stages already on this total are left as they are (as before 19 Nov 2026). */
  if (salesTotalPaise === null && before === totalPaise) return { ok: true, stages: stages.map((s) => ({ ...s })), changed: false };
  let amounts: number[];
  if (pctAt.length === 0) {
    amounts = splitAcross(totalPaise, stages.map((s) => Math.max(0, s.amountPaise)));
  } else {
    const fixed = stages.reduce((a, s, i) => a + (pctAt.includes(i) ? 0 : s.amountPaise), 0);
    amounts = stages.map((s) => s.amountPaise);
    const sales = salesTotalPaise !== null && Number.isInteger(salesTotalPaise) && salesTotalPaise > fixed && pctAt.length >= 2 ? salesTotalPaise : null;
    if (sales !== null) {
      // The design advance as on the sales final; the rest of the Design Final over the later stages.
      const advance = splitAcross(sales - fixed, pctAt.map((i) => stages[i]!.pct!))[0]!;
      const rest = totalPaise - fixed - advance;
      if (rest < 0) return { ok: false, error: 'The Design Final is less than the booking advance and design advance.' };
      const later = pctAt.slice(1);
      const parts = splitAcross(rest, later.map((i) => stages[i]!.pct!));
      amounts[pctAt[0]!] = advance;
      later.forEach((i, k) => (amounts[i] = parts[k]!));
    } else {
      const rest = totalPaise - fixed;
      if (rest < 0) return { ok: false, error: 'The Design Final is less than the fixed stages (like the booking advance).' };
      const parts = splitAcross(rest, pctAt.map((i) => stages[i]!.pct!));
      pctAt.forEach((i, k) => (amounts[i] = parts[k]!));
    }
  }
  const changed = amounts.some((a, i) => a !== stages[i]!.amountPaise);
  return { ok: true, stages: stages.map((s, i) => ({ ...s, amountPaise: amounts[i]! })), changed };
}
