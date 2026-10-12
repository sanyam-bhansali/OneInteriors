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
    <section className="card" aria-label="Terms on this quotation">
      <div className="chead">
        <h2>Terms on this quotation</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="qcheck" style={{ minHeight: 30 }}>
          <input
            type="checkbox"
            checked={terms.feeOn}
            onChange={(e) => onChange({ feeOn: e.target.checked })}
          />
          Professional fee, 7%
        </label>

        <div className="hstack" style={{ gap: 12 }}>
          <label className="qfield" style={{ flex: 1 }}>
            <span className="lbl">Modular discount %</span>
            <input
              value={terms.discountPct}
              onChange={(e) => onChange({ discountPct: e.target.value })}
              inputMode="decimal"
              className="fld num"
            />
          </label>
        </div>

        <label className="qcheck" style={{ minHeight: 30 }}>
          <input
            type="checkbox"
            checked={terms.gstOn}
            onChange={(e) => onChange({ gstOn: e.target.checked })}
          />
          GST at 18%, after discounts
        </label>

        <div className="qfield">
          <span className="lbl">Flat discount</span>
          <div className="hstack" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <select
              value={named ? terms.onSpotLabel : terms.onSpotLabel ? 'other' : ''}
              onChange={(e) =>
                onChange({ onSpotLabel: e.target.value === 'other' ? 'Special discount' : e.target.value })
              }
              className="fld" style={{ flex: 1, minWidth: 0 }}
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
              className="fld num" style={{ width: '7rem', flex: 'none' }}
            />
          </div>
          {terms.onSpotLabel && !named ? (
            <input
              value={terms.onSpotLabel}
              onChange={(e) => onChange({ onSpotLabel: e.target.value })}
              maxLength={60}
              aria-label="Name of the discount"
              className="fld" style={{ marginTop: 4 }}
            />
          ) : null}
        </div>

        <div className="hstack" style={{ gap: 12, flexWrap: 'nowrap' }}>
          {ownSchedule ? null : (
            <label className="qfield" style={{ flex: 1 }}>
              <span className="lbl">Booking ₹</span>
              <input
                value={terms.advanceRupees}
                onChange={(e) => onChange({ advanceRupees: e.target.value })}
                inputMode="numeric"
                className="fld num"
              />
            </label>
          )}
          <label className="qfield" style={{ flex: 1 }}>
            <span className="lbl">Date</span>
            <input
              type="date"
              value={terms.quoteDate}
              onChange={(e) => onChange({ quoteDate: e.target.value })}
              className="fld"
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
