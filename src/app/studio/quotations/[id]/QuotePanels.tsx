'use client';

import Link from 'next/link';
import { formatINR } from '@/lib/money';
import { formatQty, areaMilli, type QuoteTotals } from '@/modules/studio-quote/pricing';
import type { RevisionSummary, RoomTotal } from '@/modules/studio-quote/revision';
import type { QuoteRow } from '@/modules/studio-quote/quotes';
import type { PricedLine } from './QuoteLines';

const signed = (paise: number) => (paise < 0 ? `−${formatINR(Math.abs(paise))}` : formatINR(paise));

/**
 * The money (StudioQuoteBuilder's Total card), and the save beside it.
 *
 * Sticky beside the lines, because the total is the number being watched.
 * Everything here is derived from the lines on screen rather than from the
 * database, so it moves with the typing — a figure that only catches up after
 * a save is a figure nobody trusts mid-conversation.
 */
export function TotalsPanel({
  quote,
  totals,
  lineCount,
  children,
}: {
  quote: QuoteRow;
  totals: QuoteTotals;
  lineCount: number;
  /** The save button and its state, under the total. */
  children?: React.ReactNode;
}) {
  return (
    <aside className="card" aria-label="Quote total">
      <div className="chead">
        <h2>Total</h2>
        <span className="muted sm mono">
          {lineCount} {lineCount === 1 ? 'line' : 'lines'}
        </span>
      </div>

      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Row label="Modular" value={totals.modularPaise} />
        <Row label="On-site" value={totals.onsitePaise} />
        <Row label={`Professional fee, ${quote.feeBps / 100}%`} value={totals.feePaise} />
        <Row label="Sub-total" value={totals.subTotalPaise} strong />
        {totals.discountPaise > 0 ? <Row label={`Discount, ${quote.discountBps / 100}% on modular`} value={-totals.discountPaise} /> : null}
        {totals.onSpotPaise > 0 ? <Row label={quote.onSpotLabel ?? 'Additional discount'} value={-totals.onSpotPaise} /> : null}
        {totals.gstPaise > 0 ? (
          <>
            <Row label="Before GST" value={totals.beforeTaxPaise} />
            <Row label={`GST, ${quote.gstBps / 100}%`} value={totals.gstPaise} />
          </>
        ) : null}
        <div className="sumrow total">
          <dt style={{ margin: 0 }}>
            <b>What the client pays</b>
          </dt>
          <dd style={{ margin: 0 }}>
            <b className="mono">{formatINR(totals.totalPaise)}</b>
          </dd>
        </div>
      </dl>

      {totals.stages.length > 0 ? (
        <div className="qstages">
          <span className="lbl">Payment stages</span>
          {totals.stages.map((s) => (
            <div key={s.label} className="sumrow sm">
              <span>
                {s.label}
                {s.pct ? `, ${s.pct}%` : ''}
              </span>
              <span className="mono">{formatINR(s.amountPaise)}</span>
            </div>
          ))}
          <span className="muted sm" style={{ lineHeight: 1.45 }}>
            These add up to the total exactly.{' '}
            {quote.phases?.length ? (
              'Your own payment schedule, from your registration.'
            ) : (
              <>
                Set your own schedule and the defaults for new quotations in{' '}
                <Link href="/studio/settings" className="acc-t">
                  Settings
                </Link>
                .
              </>
            )}
          </span>
        </div>
      ) : null}

      {children}
    </aside>
  );
}

/**
 * Where the money is going, by room.
 *
 * Bars rather than a pie: the question is "what is the kitchen costing me"
 * against a known total, which a length answers and an angle does not.
 */
export function RoomBreakdown({ rooms }: { rooms: RoomTotal[] }) {
  if (rooms.length < 2) return null;
  const top = rooms[0]!.paise;

  return (
    <section className="card" aria-label="Where it is going">
      <div className="chead">
        <h2>Where it is going</h2>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rooms.map((room) => (
          <li key={room.room}>
            <div className="sumrow sm" style={{ marginBottom: 4 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.room}</span>
              <span className="mono" style={{ flex: 'none' }}>
                {formatINR(room.paise)} <span className="muted">{(room.shareBps / 100).toFixed(0)}%</span>
              </span>
            </div>
            <div className="qbar">
              {/* Against the biggest room, not against the total: shares of a
                  forty-line quotation are all small. */}
              <i style={{ width: `${Math.max(2, Math.round((room.paise / top) * 100))}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="sumrow">
      <dt className={strong ? '' : 'muted'} style={{ margin: 0, fontWeight: strong ? 600 : undefined }}>
        {label}
      </dt>
      <dd className="mono" style={{ margin: 0, fontWeight: strong ? 600 : undefined }}>
        {signed(value)}
      </dd>
    </div>
  );
}

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

/**
 * What moved since the client was sent this.
 *
 * The count leads and the figure follows: two changes that cancel out leave
 * the total where it was, and a screen reading "no change" while the client
 * can see their wardrobe has gone is worse than no screen at all.
 */
export function ChangesPanel({ summary, issuedOn }: { summary: RevisionSummary; issuedOn: Date | null }) {
  const sent = issuedOn ? new Date(issuedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  const moved = summary.changes.filter((c) => c.kind !== 'UNCHANGED');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="card">
        <div className="chead">
          <h2>
            {summary.identical
              ? 'Nothing has changed since you sent it.'
              : `${moved.length} ${moved.length === 1 ? 'line has' : 'lines have'} changed since you sent it.`}
          </h2>
        </div>
        <p className="muted" style={{ margin: 0, maxWidth: '64ch', lineHeight: 1.5 }}>
          Compared against the copy the client received{sent ? ` on ${sent}` : ''} — not against your last save. Drafts you revised
          before sending are not changes as far as they are concerned.
        </p>

        {summary.identical ? null : (
          <div className="hstack">
            {summary.addedCount > 0 ? <Pill kind="ADDED">{summary.addedCount} added</Pill> : null}
            {summary.removedCount > 0 ? <Pill kind="REMOVED">{summary.removedCount} removed</Pill> : null}
            {summary.repricedCount > 0 ? <Pill kind="REPRICED">{summary.repricedCount} repriced</Pill> : null}
            <span className="mono" style={{ fontWeight: 600 }}>
              {summary.deltaPaise === 0
                ? 'Total unchanged'
                : summary.deltaPaise > 0
                  ? `${formatINR(summary.deltaPaise)} more`
                  : `${formatINR(Math.abs(summary.deltaPaise))} less`}
            </span>
          </div>
        )}
      </section>

      {moved.length > 0 ? (
        <section className="card flush">
          <div className="tscroll">
            <table className="tbl" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Change</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {moved.map((change) => (
                  <tr key={`${change.room}|${change.product}|${change.kind}`}>
                    <td>
                      <b style={{ fontWeight: 600 }}>{change.product}</b>
                      <div className="muted sm">{change.room}</div>
                    </td>
                    <td>
                      <Pill kind={change.kind}>{change.kind === 'ADDED' ? 'New' : change.kind === 'REMOVED' ? 'Removed' : 'Repriced'}</Pill>
                    </td>
                    <td className="mono" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {change.kind === 'REPRICED' ? (
                        <>
                          <span className="muted" style={{ textDecoration: 'line-through' }}>
                            {formatINR(change.wasPaise)}
                          </span>{' '}
                          {formatINR(change.nowPaise)}
                        </>
                      ) : change.kind === 'ADDED' ? (
                        formatINR(change.nowPaise)
                      ) : (
                        <span className="muted" style={{ textDecoration: 'line-through' }}>
                          {formatINR(change.wasPaise)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Pill({ kind, children }: { kind: string; children: React.ReactNode }) {
  const tone = kind === 'ADDED' ? 'good' : kind === 'REMOVED' ? 'warn' : 'oi';
  return <span className={`chip ${tone}`}>{children}</span>;
}
