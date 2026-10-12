'use client';

import { DISCOUNT_NAMES } from '@/modules/studio-quote/pricing';

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

const field =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-2.5 py-2 text-[13.5px] outline-none focus:border-[var(--s-accent)]';

/**
 * The deal on this quotation: fee, modular discount, GST, a named flat
 * discount, the booking advance and the date it carries.
 *
 * Settings holds the defaults a new quotation starts from; these are the
 * figures on this one, and they move the total as they are typed, like the
 * lines do. They are saved with the lines, by the same button.
 */
export function TermsPanel({
  terms,
  onChange,
  ownSchedule,
}: {
  terms: TermsDraft;
  onChange: (patch: Partial<TermsDraft>) => void;
  /** True when the studio's own payment phases set the schedule, so the advance is one of them. */
  ownSchedule: boolean;
}) {
  const named = (DISCOUNT_NAMES as readonly string[]).includes(terms.onSpotLabel);

  return (
    <section className="s-card p-4">
      <h2 className="s-label m-0 mb-3">Terms on this quotation</h2>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-[13.5px]">
          <input
            type="checkbox"
            checked={terms.feeOn}
            onChange={(e) => onChange({ feeOn: e.target.checked })}
            className="h-[16px] w-[16px] accent-[var(--s-accent)]"
          />
          Professional fee, 7%
        </label>

        <div className="flex gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="s-label">Modular discount %</span>
            <input
              value={terms.discountPct}
              onChange={(e) => onChange({ discountPct: e.target.value })}
              inputMode="decimal"
              className={`${field} s-num w-full text-right`}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-[13.5px]">
          <input
            type="checkbox"
            checked={terms.gstOn}
            onChange={(e) => onChange({ gstOn: e.target.checked })}
            className="h-[16px] w-[16px] accent-[var(--s-accent)]"
          />
          GST at 18%, after discounts
        </label>

        <div className="flex flex-col gap-1">
          <span className="s-label">Flat discount</span>
          <div className="flex gap-2">
            <select
              value={named ? terms.onSpotLabel : terms.onSpotLabel ? 'other' : ''}
              onChange={(e) =>
                onChange({ onSpotLabel: e.target.value === 'other' ? 'Special discount' : e.target.value })
              }
              className={`${field} min-w-0 flex-1`}
            >
              <option value="">None</option>
              {DISCOUNT_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="other">Other…</option>
            </select>
            <input
              value={terms.onSpotRupees}
              onChange={(e) => onChange({ onSpotRupees: e.target.value })}
              inputMode="numeric"
              placeholder="₹"
              aria-label="Discount amount in rupees"
              className={`${field} s-num w-[6.5rem] text-right`}
            />
          </div>
          {terms.onSpotLabel && !named ? (
            <input
              value={terms.onSpotLabel}
              onChange={(e) => onChange({ onSpotLabel: e.target.value })}
              maxLength={60}
              aria-label="Name of the discount"
              className={`${field} mt-1`}
            />
          ) : null}
        </div>

        <div className="flex gap-3">
          {ownSchedule ? null : (
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="s-label">Booking ₹</span>
              <input
                value={terms.advanceRupees}
                onChange={(e) => onChange({ advanceRupees: e.target.value })}
                inputMode="numeric"
                className={`${field} s-num w-full text-right`}
              />
            </label>
          )}
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="s-label">Date</span>
            <input
              type="date"
              value={terms.quoteDate}
              onChange={(e) => onChange({ quoteDate: e.target.value })}
              className={`${field} w-full`}
            />
          </label>
        </div>
      </div>
    </section>
  );
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
