'use client';

import { estimate } from '@/modules/quotation/estimate';
import { priceEstimate, type RateCard } from '@/modules/quotation/price';
import { CATEGORY, type RateCategory } from '@/modules/quotation/categories';
import { formatINR, rupeesToPaise, type Paise } from '@/lib/money';

/**
 * What a customer would be quoted, at the numbers the studio is typing.
 *
 * ## Why this is the most useful preview in the flow
 *
 * The rate card asks for six per-square-foot figures, and a per-square-foot
 * figure is not a thing anybody has intuition about. A studio typing 1,950
 * into a wardrobe box has no idea whether the quote it produces is ₹11 lakh
 * or ₹19 lakh — and the quote is the only part a customer ever sees. They
 * find out weeks later, from a match they lost or a project they resented.
 *
 * So the rates now have a consequence on screen while they are being entered.
 * Move a rate, watch the total move.
 *
 * ## It is the real engine, not a mock-up of one
 *
 * `estimate()` and `priceEstimate()` are the same pure functions that price a
 * live customer's brief — imported rather than reimplemented, so this cannot
 * drift from what the product actually does. A preview computed a second way
 * would eventually disagree with the thing it previews, and the studio would
 * be right to trust neither.
 *
 * The one thing it invents is the home: a standard 2 BHK, full scope, stated
 * as an assumption rather than presented as a forecast.
 */

/** The commonest brief in Pune, and the least surprising thing to price. */
const SAMPLE = { propertyType: 'BHK_2', scope: 'FULL_HOME', carpetAreaSqft: 850 } as const;

export function QuotePreview({ rupees }: { rupees: Record<string, string> }) {
  /* Rupees in the boxes, paise in the engine. One conversion, at the edge. */
  const rates: RateCard = {};
  for (const [category, raw] of Object.entries(rupees)) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      rates[category as RateCategory] = rupeesToPaise(n) as Paise;
    }
  }

  const work = estimate({
    propertyType: SAMPLE.propertyType,
    carpetAreaSqft: SAMPLE.carpetAreaSqft,
    scope: SAMPLE.scope,
  });
  const priced = priceEstimate(work, rates);

  return (
    <aside className="oi-preview">
      <p className="label m-0 mb-2.5 flex items-center gap-2 text-[var(--color-ink-3)]">
        What this quotes
        <span aria-hidden="true" className="oi-live-dot" />
      </p>

      <div className="overflow-hidden rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper)] shadow-[0_1px_2px_rgba(38,32,25,.04),0_10px_28px_-18px_rgba(38,32,25,.3)]">
        <div className="border-b border-[var(--color-rule)] px-5 py-3.5">
          <p className="label m-0 text-[var(--color-ink-3)]">A sample brief</p>
          <p className="m-0 text-[14.5px] font-medium text-[var(--color-ink)]">
            2 BHK · {SAMPLE.carpetAreaSqft} sqft · full home
          </p>
        </div>

        {priced.ok ? (
          <div className="px-5 py-4">
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {priced.quote.lines.map((line) => (
                <li
                  key={line.category}
                  className="flex items-baseline justify-between gap-3 text-[13px]"
                >
                  <span className="min-w-0 truncate text-[var(--color-ink-2)]">{line.label}</span>
                  <span className="flex-none font-[family-name:var(--font-mono)] tabular-nums text-[var(--color-ink)]">
                    {formatINR(line.amountPaise)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 border-t border-dashed border-[var(--color-rule)] pt-3">
              {/* The band, never the midpoint alone. Showing one number for an
                  estimate built on assumed quantities is the thing this whole
                  quoting engine refuses to do, and the preview must not do it
                  either — a studio who reads a single figure here will quote
                  it to somebody. */}
              <p className="m-0 flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium text-[var(--color-ink)]">
                  A customer sees
                </span>
                <span className="flex-none font-[family-name:var(--font-mono)] text-[14.5px] font-medium tabular-nums text-[var(--color-petrol)]">
                  {formatINR(priced.quote.lowPaise)} – {formatINR(priced.quote.highPaise)}
                </span>
              </p>
              <p className="m-0 mt-1 text-[11.5px] leading-relaxed text-[var(--color-ink-3)]">
                Including GST and your design fee, ±
                {Math.round(priced.quote.variancePct * 100)}% on assumed quantities.
              </p>
            </div>

            {priced.quote.notPriced.length > 0 ? (
              <p className="m-0 mt-3 text-[11.5px] leading-relaxed text-[var(--color-brass)]">
                {priced.quote.notPriced.map((c) => CATEGORY[c].label).join(', ')} not priced — a
                customer is told it was excluded, never that it was free.
              </p>
            ) : null}
          </div>
        ) : (
          /* Named, not blank. "Fill in the rates" is what the form already
             says; this says which ones are stopping a quote existing, which
             is the only thing this panel can usefully add while it cannot
             price anything. */
          <div className="px-5 py-5">
            <p className="m-0 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
              No quote yet. {priced.missing.length === 1 ? 'Still missing' : 'Still missing'}{' '}
              {priced.missing.map((c) => CATEGORY[c].label.toLowerCase()).join(', ')}.
            </p>
            <p className="m-0 mt-2 text-[12px] leading-relaxed text-[var(--color-ink-3)]">
              A studio a customer cannot get a quote from does not appear in their results at
              all.
            </p>
          </div>
        )}
      </div>

      <p className="m-0 mt-2.5 text-[12px] leading-relaxed text-[var(--color-ink-3)]">
        Priced by the same engine that quotes a real brief — not an illustration. The home is a
        sample; the arithmetic is not.
      </p>
    </aside>
  );
}
