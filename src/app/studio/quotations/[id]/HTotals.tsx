'use client';

import Link from 'next/link';
import { formatINR } from '@/lib/money';
import type { QuoteTotals } from '@/modules/studio-quote/pricing';

/**
 * Hauspire's totals table (`Totals.tsx`), on our figures (`computeTotals`,
 * paise): the two sums, the professional fee with its tick, the sub-total,
 * the modular discount with its % box, the named flat discount, the Total
 * Project Value band, GST with its tick and the grand total — then the
 * payment stages, which are this studio's own schedule and add up to the
 * total exactly.
 */
export function TotalsTable({
  totals,
  feeBps,
  feeOn,
  gstOn,
  discountPct,
  onSpotLabel,
  onFeeOn,
  onGstOn,
  onDiscountPct,
  ownSchedule,
  readOnly = false,
}: {
  totals: QuoteTotals;
  /** The quotation's own fee (7%, or an older quotation's figure). */
  feeBps: number;
  feeOn: boolean;
  gstOn: boolean;
  /** As typed. */
  discountPct: string;
  onSpotLabel: string | null;
  onFeeOn?: (on: boolean) => void;
  onGstOn?: (on: boolean) => void;
  onDiscountPct?: (pct: string) => void;
  ownSchedule: boolean;
  readOnly?: boolean;
}) {
  const feePct = feeBps > 0 ? feeBps / 100 : 7;
  return (
    <div className="htotals">
      <table className="htable htot">
        <tbody>
          <tr>
            <th scope="row">Sum-Total (MO-01) — Modular</th>
            <td className="mono">{formatINR(totals.modularPaise)}</td>
          </tr>
          <tr>
            <th scope="row">Sum-Total (NM-01) — Non-Modular</th>
            <td className="mono">{formatINR(totals.onsitePaise)}</td>
          </tr>
          <tr className={feeOn ? '' : 'off'}>
            <th scope="row">
              {onFeeOn ? (
                <input type="checkbox" checked={feeOn} disabled={readOnly} onChange={(e) => onFeeOn(e.target.checked)} aria-label="Include professional fees" className="htick" />
              ) : null}
              Professional fees ({feePct}%){feeOn ? '' : ' — removed'}
            </th>
            <td className="mono">{feeOn ? formatINR(totals.feePaise) : '—'}</td>
          </tr>
          <tr>
            <th scope="row">Sub-Total</th>
            <td className="mono">{formatINR(totals.subTotalPaise)}</td>
          </tr>
          <tr className="neg">
            <th scope="row">
              Discount on Modular
              {onDiscountPct ? (
                <input
                  value={discountPct}
                  onChange={(e) => onDiscountPct(e.target.value)}
                  inputMode="decimal"
                  disabled={readOnly}
                  aria-label="Discount on modular, percent"
                  className="hcell num hpct"
                />
              ) : (
                ` ${discountPct}`
              )}
              %
            </th>
            <td className="mono">− {formatINR(totals.discountPaise)}</td>
          </tr>
          {totals.onSpotPaise > 0 ? (
            <tr className="neg">
              <th scope="row">{onSpotLabel || 'Additional discount'}</th>
              <td className="mono">− {formatINR(totals.onSpotPaise)}</td>
            </tr>
          ) : null}
          <tr className={gstOn ? 'strong' : 'hband'}>
            <th scope="row">Total Project Value{gstOn ? ' (before GST)' : ''}</th>
            <td className="mono">{formatINR(totals.beforeTaxPaise)}</td>
          </tr>
          <tr className={gstOn ? '' : 'off'}>
            <th scope="row">
              {onGstOn ? (
                <input type="checkbox" checked={gstOn} disabled={readOnly} onChange={(e) => onGstOn(e.target.checked)} aria-label="Add GST" className="htick" />
              ) : null}
              GST (18%){gstOn ? '' : ' — not added'}
            </th>
            <td className="mono">{gstOn ? `+ ${formatINR(totals.gstPaise)}` : '—'}</td>
          </tr>
          {gstOn ? (
            <tr className="hband">
              <th scope="row">Grand Total (incl. GST)</th>
              <td className="mono">{formatINR(totals.totalPaise)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <h3 className="hsec">Payment stages{gstOn ? ' (incl. GST)' : ''}</h3>
      {totals.stages.length > 0 ? (
        <table className="htable htot hstages">
          <tbody>
            {totals.stages.map((s) => (
              <tr key={s.label}>
                <th scope="row">
                  {s.label}
                  {s.pct ? ` (${s.pct}%)` : ''}
                </th>
                <td className="mono">{formatINR(s.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted sm" style={{ margin: 0 }}>
          The stages appear once the quotation has a total.
        </p>
      )}
      <p className="muted hhelp">
        These add up to the total exactly.{' '}
        {ownSchedule ? (
          'Your own payment schedule, from Settings.'
        ) : (
          <>
            Set your own schedule in{' '}
            <Link href="/studio/settings" className="acc-t">
              Settings
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}
