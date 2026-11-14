/**
 * The payment stages on the Design Final's total (owner, 14 Nov 2026: "after
 * marking the design quotation as final it still doesn't change the payment
 * stages total"). Pure; tested in tests/design-final-restage.test.ts.
 *
 * A stage with a fixed amount (the booking advance, `pct` null) keeps it; the
 * stages with a percentage share the rest of the new total by their
 * percentages, exactly (`splitAcross`). With no percentage stages at all, the
 * amounts are scaled to the new total. Payments already recorded stay
 * against their stage: the ledger shows the new amount due on each.
 */

import { splitAcross } from '@/lib/money';

export interface Stage {
  label: string;
  pct: number | null;
  amountPaise: number;
}

export type Restage = { ok: true; stages: Stage[]; changed: boolean } | { ok: false; error: string };

export function restageOnTotal(stages: readonly Stage[], totalPaise: number): Restage {
  if (!Number.isInteger(totalPaise) || totalPaise <= 0) return { ok: false, error: 'The Design Final has no total.' };
  if (stages.length === 0) return { ok: false, error: 'This project has no payment stages.' };
  const before = stages.reduce((a, s) => a + s.amountPaise, 0);
  if (before === totalPaise) return { ok: true, stages: stages.map((s) => ({ ...s })), changed: false };
  const pctAt = stages.map((s, i) => (s.pct !== null && s.pct > 0 ? i : -1)).filter((i) => i >= 0);
  let amounts: number[];
  if (pctAt.length === 0) {
    amounts = splitAcross(totalPaise, stages.map((s) => Math.max(0, s.amountPaise)));
  } else {
    const fixed = stages.reduce((a, s, i) => a + (pctAt.includes(i) ? 0 : s.amountPaise), 0);
    const rest = totalPaise - fixed;
    if (rest < 0) return { ok: false, error: 'The Design Final is less than the fixed stages (like the booking advance).' };
    const parts = splitAcross(rest, pctAt.map((i) => stages[i]!.pct!));
    amounts = stages.map((s) => s.amountPaise);
    pctAt.forEach((i, k) => (amounts[i] = parts[k]!));
  }
  return { ok: true, stages: stages.map((s, i) => ({ ...s, amountPaise: amounts[i]! })), changed: true };
}
