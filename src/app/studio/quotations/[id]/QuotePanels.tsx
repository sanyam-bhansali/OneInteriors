'use client';

import Link from 'next/link';
import { formatINR } from '@/lib/money';
import { formatQty, areaMilli, type QuoteTotals } from '@/modules/studio-quote/pricing';
import type { QuoteRow } from '@/modules/studio-quote/quotes';
import type { PricedLine } from './QuoteLines';


/**
 * The document, as the client will read it.
 *
 * Here and not only on the print page, because "what does this look like to
 * them" is a question asked while editing, not after. It is a preview and
 * says so: the printed copy carries the full terms, the payment schedule and
 * the signature block. The studio's own accent colour draws its rules.
 */
export function DocumentPreview({
  quote,
  lines,
  rooms,
  totals,
  branding,
  showMark,
  markText,
  logoUrl,
}: {
  quote: QuoteRow;
  lines: PricedLine[];
  rooms: string[];
  totals: QuoteTotals;
  branding: {
    legalName: string;
    addressLine: string | null;
    city: string;
    pincode: string | null;
    gstin: string | null;
    phone: string | null;
    email: string | null;
    accentHex: string;
  } | null;
  showMark: boolean;
  markText: string;
  logoUrl: string | null;
}) {
  if (!branding) {
    return (
      <div className="empty">
        <b>Your studio details are not filled in yet.</b>
        <span className="muted sm" style={{ maxWidth: '62ch', lineHeight: 1.5 }}>
          A quotation carries your registered name, your address and your GSTIN — a document without them is one a client cannot
          act on.{' '}
          <Link href="/studio/settings" className="acc-t" style={{ fontWeight: 600 }}>
            Add them in Settings
          </Link>{' '}
          and this preview fills in.
        </span>
      </div>
    );
  }

  /* Validated at the point of use. `accentHex` is studio-supplied and this is
     interpolated into a style, where React does not escape. A rejected value
     falls back to the studio accent rather than to nothing. */
  const accent = /^#[0-9a-fA-F]{6}$/.test(branding.accentHex) ? branding.accentHex : 'var(--acc)';

  return (
    <article className="qdoc" aria-label="What the client sees">
      <header className="qdoc-sec hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px solid ${accent}`, paddingTop: 24, paddingBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" style={{ marginBottom: 8, maxHeight: 46, maxWidth: 190, objectFit: 'contain' }} />
          ) : null}
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{branding.legalName}</p>
          <p className="muted sm" style={{ margin: '2px 0 0', lineHeight: 1.5 }}>
            {[branding.addressLine, branding.city, branding.pincode].filter(Boolean).join(', ')}
          </p>
          <p className="muted sm" style={{ margin: 0 }}>
            {[branding.phone, branding.email].filter(Boolean).join(' · ')}
          </p>
          {branding.gstin ? (
            <p className="mono muted" style={{ margin: '2px 0 0', fontSize: 12 }}>
              GSTIN {branding.gstin}
            </p>
          ) : null}
        </div>

        <div style={{ textAlign: 'right' }}>
          <p className="qdoc-k">Quotation</p>
          <p className="mono" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            {quote.number}
          </p>
          <p className="muted sm" style={{ margin: '4px 0 0' }}>
            {new Date(quote.quoteDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </header>

      <div className="qdoc-sec">
        <p className="qdoc-k">For</p>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{quote.clientName}</p>
        <p className="muted sm" style={{ margin: 0 }}>
          {[quote.society, quote.locality, quote.config].filter(Boolean).join(' · ')}
        </p>
      </div>

      {lines.length === 0 ? (
        <p className="muted qdoc-sec" style={{ margin: 0, fontStyle: 'italic' }}>
          Nothing on this quotation yet.
        </p>
      ) : (
        rooms.map((room) => {
          const inRoom = lines.filter((l) => l.room === room);
          if (inRoom.length === 0) return null;

          return (
            <section key={room} className="qdoc-sec" style={{ borderBottom: 0 }}>
              <div className="sumrow" style={{ alignItems: 'baseline', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--fill2)' }}>
                <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase' }}>{room}</h3>
                <span className="mono sm" style={{ fontWeight: 500 }}>
                  {formatINR(inRoom.reduce((a, l) => a + l.amountPaise, 0))}
                </span>
              </div>

              <table>
                <tbody>
                  {inRoom.map((line) => (
                    <tr key={line.key}>
                      <td>
                        <span>{line.product}</span>
                        {line.details ? (
                          <span className="muted" style={{ display: 'block', fontSize: 12, lineHeight: 1.35 }}>
                            {line.details}
                          </span>
                        ) : null}
                      </td>
                      <td className="mono muted" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {measure(line)}
                      </td>
                      <td className="mono" style={{ whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 500 }}>
                        {line.amountPaise > 0 ? formatINR(line.amountPaise) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })
      )}

      <div className="qdoc-sec" style={{ borderTop: '1px solid var(--fill2)', paddingTop: 20, paddingBottom: 20 }}>
        <dl style={{ margin: '0 0 0 auto', maxWidth: '22rem', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <DocRow label="Modular" value={totals.modularPaise} />
          <DocRow label="On-site" value={totals.onsitePaise} />
          <DocRow label={`Professional fee · ${quote.feeBps / 100}%`} value={totals.feePaise} />
          {totals.discountPaise > 0 ? <DocRow label="Discount" value={-totals.discountPaise} /> : null}
          {totals.onSpotPaise > 0 ? <DocRow label={quote.onSpotLabel ?? 'Additional discount'} value={-totals.onSpotPaise} /> : null}
          {totals.gstPaise > 0 ? (
            <>
              <DocRow label="Before GST" value={totals.beforeTaxPaise} />
              <DocRow label={`GST · ${quote.gstBps / 100}%`} value={totals.gstPaise} />
            </>
          ) : null}
          <div className="sumrow" style={{ alignItems: 'baseline', marginTop: 4, paddingTop: 8, borderTop: `2px solid ${accent}` }}>
            <dt style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Total</dt>
            <dd className="mono" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
              {formatINR(totals.totalPaise)}
            </dd>
          </div>
        </dl>
      </div>

      <footer className="qdoc-sec" style={{ borderBottom: 0 }}>
        <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
          A preview. The printed copy carries your terms, the payment schedule and the signature block.
        </p>
        {/* Below the GSTIN, never in the terms and never beside their name. */}
        {showMark ? (
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 11, fontStyle: 'italic' }}>
            {markText}
          </p>
        ) : null}
      </footer>
    </article>
  );
}

/** What the client sees in the size column: the measurement, not the arithmetic. */
function measure(line: PricedLine): string {
  if (line.unit === 'AREA') {
    if (!line.widthMm || !line.heightMm) return '—';
    return `${line.widthMm} × ${line.heightMm} mm · ${formatQty(areaMilli(line.widthMm, line.heightMm))} sq ft`;
  }
  if (line.qtyMilli == null) return '—';
  const qty = formatQty(line.qtyMilli);
  if (line.unit === 'UNIT') return `${qty} ${Number(qty) === 1 ? 'no.' : 'nos.'}`;
  if (line.unit === 'RFT') return `${qty} rft`;
  return `${qty} sq ft`;
}

function DocRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="sumrow" style={{ fontSize: 13 }}>
      <dt className="muted" style={{ margin: 0 }}>
        {label}
      </dt>
      <dd className="mono" style={{ margin: 0 }}>
        {value < 0 ? `− ${formatINR(Math.abs(value))}` : formatINR(value)}
      </dd>
    </div>
  );
}
