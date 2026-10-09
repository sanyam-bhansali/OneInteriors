/**
 * "Usual in Pune" for a quote line: the spread of what the listed studios'
 * own filed rates come to for the same line on the same home.
 *
 * Rupee amounts only. A studio's per-unit rate is never shown to a customer,
 * and the range is never shown at all until enough studios price the line for
 * it to mean something — two rate cards are a comparison, not a market.
 */

import type { FirstQuote } from '@/modules/quotation/first-quote';
import type { Paise } from '@/lib/money';

export const MIN_STUDIOS_FOR_RANGE = 3;

export interface LineRange {
  lowPaise: Paise;
  highPaise: Paise;
  studios: number;
}

/** Line code → range, from every studio's quote for this brief. */
export function puneRanges(quotes: FirstQuote[], min = MIN_STUDIOS_FOR_RANGE): Map<string, LineRange> {
  const amounts = new Map<string, Paise[]>();
  for (const q of quotes) {
    for (const l of q.lines) {
      if (l.amountPaise <= 0) continue;
      const list = amounts.get(l.code) ?? [];
      list.push(l.amountPaise);
      amounts.set(l.code, list);
    }
  }
  const out = new Map<string, LineRange>();
  for (const [code, list] of amounts) {
    if (list.length < min) continue;
    out.set(code, { lowPaise: Math.min(...list), highPaise: Math.max(...list), studios: list.length });
  }
  return out;
}

/** Where an amount sits against its range, in words. */
export function against(amount: Paise, r: LineRange): 'below' | 'within' | 'above' {
  if (amount < r.lowPaise) return 'below';
  if (amount > r.highPaise) return 'above';
  return 'within';
}
