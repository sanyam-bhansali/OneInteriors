import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { getQuote, totalsFor } from '@/modules/studio-quote/quotes';
import { myBranding } from '@/modules/studio-quote/store';
import { UNIT_LABELS, formatQty, WORK_CODE_LABELS } from '@/modules/studio-quote/pricing';
import { ROOM_CATEGORIES } from '@/modules/studio-quote/starter-catalogue';
import { PrintButton } from './PrintButton';

export const metadata: Metadata = {
  title: 'Quotation',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The document, as the client receives it.
 *
 * ## The rule this page exists to keep
 *
 * **Nothing of ours appears on it.** Not our name, not our logo, not our words,
 * not our terms. The studio's registered name is at the top, their GSTIN and
 * address are in the footer, their opening note and their terms are the only
 * prose on the page. A quotation is a document a studio is legally answerable
 * for, and putting our sentences on it would be committing them to promises
 * they never read.
 *
 * That is the difference between white-label and "ours with their name typed
 * in", and it is why the copy fields in Settings start empty rather than with a
 * template.
 *
 * ## Why print rather than a generated PDF
 *
 * The browser's own print-to-PDF, styled with `@media print`. A server-side
 * renderer means headless Chrome or LibreOffice on the deployment — neither
 * exists on Vercel's serverless runtime, and adding a worker for one feature is
 * a whole piece of infrastructure. The studio gets a real PDF, selectable and
 * sharp, from the button they already know.
 *
 * Deliberately outside the studio shell: no sidebar, no chrome, nothing that
 * would land on the paper.
 */
export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [quote, branding] = await Promise.all([getQuote(id), myBranding()]);

  if (!quote) notFound();

  const totals = totalsFor(quote);
  const rooms = ROOM_CATEGORIES.map((room) => ({
    room,
    lines: quote.lines.filter((l) => l.room === room),
  })).filter((g) => g.lines.length > 0);

  const issued = (quote.issuedOn ?? new Date()).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="quote-doc">
      <PrintButton
        filename={`${quote.clientName} — ${branding?.legalName ?? 'Quotation'} ${quote.number}`}
      />

      <article className="sheet">
        {/* ── Letterhead ── */}
        <header className="head">
          <div>
            <h1>{branding?.legalName ?? 'Your studio'}</h1>
            <p className="muted">
              {[branding?.addressLine, branding?.city, branding?.pincode]
                .filter(Boolean)
                .join(', ')}
            </p>
            <p className="muted">
              {[branding?.phone, branding?.email, branding?.website].filter(Boolean).join(' · ')}
            </p>
            {branding?.gstin ? <p className="muted mono">GSTIN {branding.gstin}</p> : null}
          </div>

          <div className="meta">
            <p className="label">Quotation</p>
            <p className="mono big">{quote.number}</p>
            <p className="muted">{issued}</p>
          </div>
        </header>

        {/* ── Who it is for ── */}
        <section className="to">
          <p className="label">Prepared for</p>
          <p className="name">{quote.clientName}</p>
          <p className="muted">
            {[quote.society, quote.locality, quote.config, quote.carpetSqft ? `${quote.carpetSqft} sq ft` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </section>

        {quote.welcomeNote ? <p className="welcome">{quote.welcomeNote}</p> : null}

        {/* ── The work ── */}
        {rooms.map((group) => (
          <section key={group.room} className="room">
            <h2>{group.room}</h2>
            <table>
              <thead>
                <tr>
                  <th className="w-desc">Item</th>
                  <th className="w-spec">Size</th>
                  <th className="w-qty">Qty</th>
                  <th className="w-rate">Rate</th>
                  <th className="w-amt">Amount</th>
                </tr>
              </thead>
              <tbody>
                {group.lines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span className="item">{l.product}</span>
                      {l.details ? <span className="detail">{l.details}</span> : null}
                      <span className="code">{WORK_CODE_LABELS[l.code]}</span>
                    </td>
                    <td className="mono">
                      {l.unit === 'AREA' && l.widthMm && l.heightMm
                        ? `${l.widthMm} × ${l.heightMm} mm`
                        : '—'}
                    </td>
                    <td className="mono num">
                      {l.qtyMilli || (l.unit === 'AREA' && l.widthMm && l.heightMm)
                        ? `${formatQty(
                            l.unit === 'AREA' && l.widthMm && l.heightMm
                              ? Math.round(((l.widthMm * l.heightMm) / 92_903.04) * 1000)
                              : (l.qtyMilli ?? 0),
                          )} ${UNIT_LABELS[l.unit].toLowerCase()}`
                        : '—'}
                    </td>
                    <td className="mono num">{l.ratePaise > 0 ? formatINR(l.ratePaise) : '—'}</td>
                    <td className="mono num strong">{formatINR(l.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>{group.room} total</td>
                  <td className="mono num strong">
                    {formatINR(group.lines.reduce((a, l) => a + l.amountPaise, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>
        ))}

        {/* ── Money ── */}
        <section className="totals">
          <table>
            <tbody>
              <tr><td>Modular work</td><td className="mono num">{formatINR(totals.modularPaise)}</td></tr>
              <tr><td>On-site work</td><td className="mono num">{formatINR(totals.onsitePaise)}</td></tr>
              <tr><td>Professional fee ({quote.feeBps / 100}%)</td><td className="mono num">{formatINR(totals.feePaise)}</td></tr>
              <tr className="rule"><td>Sub-total</td><td className="mono num strong">{formatINR(totals.subTotalPaise)}</td></tr>
              {totals.discountPaise > 0 ? (
                <tr><td>Discount ({quote.discountBps / 100}% on modular)</td><td className="mono num">− {formatINR(totals.discountPaise)}</td></tr>
              ) : null}
              {totals.onSpotPaise > 0 ? (
                <tr><td>Additional reduction</td><td className="mono num">− {formatINR(totals.onSpotPaise)}</td></tr>
              ) : null}
              <tr className="grand"><td>Total</td><td className="mono num">{formatINR(totals.totalPaise)}</td></tr>
            </tbody>
          </table>
        </section>

        {totals.stages.length > 0 ? (
          <section className="stages">
            <h2>Payment schedule</h2>
            <table>
              <tbody>
                {totals.stages.map((s) => (
                  <tr key={s.label}>
                    <td>
                      <span className="item">{s.label}</span>
                      <span className="detail">{s.detail}</span>
                    </td>
                    <td className="mono num strong">{formatINR(s.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {quote.terms ? (
          <section className="terms">
            <h2>Terms and conditions</h2>
            <p>{quote.terms}</p>
          </section>
        ) : null}

        <footer className="foot">
          <p>
            {branding?.legalName}
            {branding?.gstin ? ` · GSTIN ${branding.gstin}` : ''}
          </p>
          <p className="muted">
            All figures in Indian rupees. This quotation is an estimate against the scope described
            above; any change to that scope changes the figure.
          </p>
        </footer>
      </article>

      {/* Scoped to this page. Nothing here uses the studio-app tokens — the
          document is a piece of paper, not a screen. */}
      <style>{`
        .quote-doc { background: #f3f3ef; min-height: 100dvh; padding: 24px 16px 64px; color: #16181a; }
        .sheet {
          max-width: 820px; margin: 0 auto; background: #fff; padding: 44px 46px;
          font-family: var(--font-sans); font-size: 12.5px; line-height: 1.55;
          box-shadow: 0 1px 3px rgba(0,0,0,.09);
        }
        .sheet h1 { font-family: var(--font-display); font-size: 25px; line-height: 1.15; margin: 0 0 6px; letter-spacing: -.01em; }
        .sheet h2 { font-size: 13px; font-weight: 700; margin: 26px 0 8px; letter-spacing: .01em; }
        .sheet p { margin: 0 0 3px; }
        .muted { color: #5d6266; font-size: 11.5px; }
        .mono { font-family: var(--font-mono); }
        .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .strong { font-weight: 600; }
        .label { font-family: var(--font-mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: .13em; color: #7b8085; margin: 0 0 3px; }

        .head { display: flex; justify-content: space-between; gap: 32px; align-items: flex-start;
                border-bottom: 2px solid #16181a; padding-bottom: 16px; }
        .meta { text-align: right; flex: none; }
        .meta .big { font-size: 15px; font-weight: 600; margin-bottom: 3px; }

        .to { margin-top: 20px; }
        .to .name { font-size: 16px; font-weight: 600; }

        .welcome { margin-top: 18px; padding: 12px 14px; background: #f7f7f3; font-size: 12px; line-height: 1.6; white-space: pre-wrap; }

        table { width: 100%; border-collapse: collapse; }
        thead th { text-align: left; font-family: var(--font-mono); font-size: 9.5px; text-transform: uppercase;
                   letter-spacing: .1em; color: #7b8085; font-weight: 500; padding: 5px 7px; border-bottom: 1px solid #d9dbd6; }
        thead th.w-qty, thead th.w-rate, thead th.w-amt { text-align: right; }
        tbody td { padding: 7px; border-bottom: 1px solid #ecedea; vertical-align: top; }
        tfoot td { padding: 7px; font-weight: 600; border-top: 1px solid #d9dbd6; }
        tfoot td:first-child { text-align: right; font-size: 11.5px; }
        .item { display: block; font-weight: 500; }
        .detail { display: block; color: #5d6266; font-size: 11px; line-height: 1.45; margin-top: 1px; }
        .code { display: inline-block; margin-top: 3px; font-family: var(--font-mono); font-size: 9px;
                text-transform: uppercase; letter-spacing: .09em; color: #7b8085; }
        .w-spec { width: 108px; } .w-qty { width: 96px; } .w-rate { width: 92px; } .w-amt { width: 104px; }

        .totals { margin-top: 26px; display: flex; justify-content: flex-end; }
        .totals table { width: 330px; }
        .totals td { padding: 5px 7px; border: 0; }
        .totals tr.rule td { border-top: 1px solid #d9dbd6; padding-top: 8px; }
        .totals tr.grand td { border-top: 2px solid #16181a; padding-top: 9px; font-size: 15px; font-weight: 700; }

        .stages td { padding: 7px; border-bottom: 1px solid #ecedea; }
        .terms p { white-space: pre-wrap; font-size: 11.5px; line-height: 1.6; color: #3d4144; }

        .foot { margin-top: 32px; padding-top: 12px; border-top: 1px solid #d9dbd6; }
        .foot p:first-child { font-weight: 600; font-size: 11.5px; }

        @media print {
          .quote-doc { background: #fff; padding: 0; }
          .sheet { box-shadow: none; max-width: none; padding: 0; }
          .no-print { display: none !important; }
          /* A room should not be split across a page break mid-table if it can
             be helped, and a header alone at the foot of a page is worse than
             a slightly short page. */
          .room, .stages, .totals { break-inside: avoid; }
          h2 { break-after: avoid; }
          tr { break-inside: avoid; }
          @page { margin: 14mm 12mm; }
        }
      `}</style>
    </div>
  );
}
