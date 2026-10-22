import type { CSSProperties, ReactNode } from 'react';
import { formatINR } from '@/lib/money';
import { DEFAULT_DISCOUNT_NAME, type QuoteTotals } from '@/modules/studio-quote/pricing';
import type { PaymentStage } from '@/modules/studio-sales/payment-template';
import {
  STAGES_NOTE,
  boldSegments,
  docColours,
  docDate,
  docRooms,
  docStages,
  donutPalette,
  parseTerms,
  roomShares,
  type DocHead,
  type DocLineInput,
  type DocRoom,
  type DocSpecRow,
  type DocStudio,
} from '@/modules/studio-quote/document';

export type { DocHead, DocStudio };

/**
 * The quotation PDF, one format for every studio (owner's sample, 13 Oct
 * 2026): the brand pages, the quotation, the summary, the stages, the
 * material specification and the terms. Used by the builder's PDF preview,
 * "Save & Quotation PDF" (the print page) and the Final PDF (its opening
 * pages and styling). No hooks and no `'use client'`, so the server page and
 * the client builder render the very same markup; every figure is handed in
 * already computed (`computeTotals`), nothing is priced here.
 *
 * Print styles live in quote-doc.css (imported by the pages that render
 * this, so the render script, scripts/render-quote-pdf.ts, can load this
 * file in Node and inline the stylesheet itself); the studio's own colour
 * (Settings, checked by `safeAccent`) draws the bands — Hauspire's maroon
 * gives the old app's exact colours.
 *
 * ## Exactly the old app's PDF (owner, 22 Oct 2026)
 *
 * The quotation pages are Hauspire's `PrintDocument` + `QuoteSummary`
 * element for element: the header grid, each room's band above its table
 * (the column header repeats on a new page, the band does not), every
 * figure printed as `Math.round(n).toLocaleString("en-IN")` (0 prints "0"),
 * MO-01 amounts struck through with the discounted figure in green, Units
 * only on a per-unit line, the Discount on Modular row always shown, the
 * flat discount as "<name> (₹)", the summary by room with its donut, the
 * totals box, the stages with their End Deliverables, the material
 * specification with its Brand column, then the terms on their own pages.
 * docs/studio-os/QUOTE-PARITY.md lists what is ours on top (the drawn cover
 * when there are no brand pages, the welcome note, line notes, the footer).
 */

export interface QuotationDocProps {
  studio: DocStudio | null;
  /** Signed links to the studio's own full-page brand images, in order. */
  brandPages: string[];
  head: DocHead;
  lines: DocLineInput[];
  roomOrder: string[];
  totals: QuoteTotals;
  feeBps: number;
  discountBps: number;
  gstBps: number;
  onSpotLabel: string | null;
  /** The studio's payment stages with their end deliverables; null uses `totals.stages`. */
  schedule: PaymentStage[] | null;
  spec: DocSpecRow[];
  terms: string | null;
  welcomeNote?: string | null;
  showMark: boolean;
  markText: string;
  validDays?: number;
  /** Anything the page adds after the material specification (the floor plan). */
  extra?: ReactNode;
  /** Inside the builder: no grey desk around the pages. */
  embedded?: boolean;
}

/** A figure as the old PDF prints it: `Math.round(rupees).toLocaleString("en-IN")`. */
export const n = (paise: number) => formatINR(Math.round(paise / 100) * 100 + 0, { symbol: false });
/** The same with the rupee sign, for the grand total and the donut. */
export const r = (paise: number) => `₹${n(paise)}`;

/**
 * A line's note for the client, under its details like a comment in the
 * margin of a reviewed document (owner's team, 15 Oct 2026). Nothing when
 * the line has none.
 */
export function LineNote({ text }: { text: string | null | undefined }) {
  const t = text?.trim();
  if (!t) return null;
  return (
    <span className="qd-linenote">
      <b>Note:</b> {t}
    </span>
  );
}

/** The coloured frame every page of the document sits in. */
export function DocFrame({ accentHex, embedded = false, children }: { accentHex: string | null; embedded?: boolean; children: ReactNode }) {
  const c = docColours(accentHex);
  const style = { '--qd-acc': c.acc, '--qd-band': c.band, '--qd-head': c.head, '--qd-line': c.line, '--qd-tint': c.tint } as CSSProperties;
  return (
    <div className={`qd${embedded ? ' qd-embed' : ''}`} style={style}>
      {children}
    </div>
  );
}

/** The studio's brand pages, or a cover drawn from its details when it has none. */
export function DocOpening({ studio, brandPages, head, final = false }: { studio: DocStudio | null; brandPages: string[]; head: DocHead; final?: boolean }) {
  if (brandPages.length > 0) {
    return (
      <>
        {brandPages.map((url, i) => (
          <section key={url} className="qd-sheet qd-brand" aria-label={`Brand page ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" />
          </section>
        ))}
      </>
    );
  }
  return <DocCover studio={studio} head={head} final={final} />;
}

function DocCover({ studio, head, final }: { studio: DocStudio | null; head: DocHead; final: boolean }) {
  const name = studio?.tradeName || studio?.name || 'Your studio';
  const address = [studio?.addressLine, studio?.city, studio?.pincode].filter(Boolean).join(', ');
  const contact = [studio?.phone, studio?.email, studio?.website].filter(Boolean) as string[];
  const facts = (studio?.facts ?? []).slice(0, 3);
  return (
    <section className="qd-sheet qd-cover" aria-label="Cover">
      <div className="qd-cover-top">
        <span className="qd-stripes" aria-hidden />
        <div className="qd-cover-logo">
          {studio?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={studio.logoUrl} alt="" />
          ) : (
            <span className="qd-cover-mark">{name}</span>
          )}
        </div>
        <span className="qd-block" aria-hidden />
      </div>

      <div className="qd-cover-mid">
        <p className="qd-cover-title">{final ? 'FINAL QUOTATION' : 'QUOTATION'}</p>
        <p className="qd-rule" aria-hidden>
          <span />
        </p>
        <p className="qd-cover-sub">Interior design proposal</p>
        {facts.length > 0 ? (
          <ul className="qd-facts">
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : null}
        <p className="qd-cover-for">
          Prepared for <b>{head.clientName || '—'}</b>
          <br />
          Quotation No {head.number} · {docDate(head.date)}
        </p>
      </div>

      <div className="qd-cover-foot">
        <span className="qd-block qd-block-low" aria-hidden />
        <div className="qd-cover-studio">
          <p className="qd-cover-name">{name}</p>
          {address ? <p>{address}</p> : null}
          {contact.length > 0 ? (
            <p className="qd-cover-contact">
              {contact.map((c, i) => (
                <span key={c}>
                  {i > 0 ? <i aria-hidden> | </i> : null}
                  {c}
                </span>
              ))}
            </p>
          ) : null}
          <p className="qd-cover-copy">
            © {new Date(head.date).getFullYear() || new Date().getFullYear()} {name}
          </p>
        </div>
      </div>
    </section>
  );
}

/** The whole quotation PDF. */
export function QuotationDocument(props: QuotationDocProps) {
  const { studio, head, totals } = props;
  const rooms = docRooms(props.lines, props.roomOrder, props.discountBps);
  const validDays = props.validDays ?? 30;
  const validUntil = docDate(new Date(new Date(head.date).getTime() + validDays * 86_400_000));

  return (
    <DocFrame accentHex={studio?.accentHex ?? null} embedded={props.embedded}>
      <DocOpening studio={studio} brandPages={props.brandPages} head={head} />

      <section className="qd-sheet qd-quote" aria-label="Quotation">
        <div className="qd-head">
          <Field k="Client Name" v={head.clientName || '—'} />
          <Field k="Quotation No" v={head.number || 'Draft'} />
          <Field k="Client Mobile" v={head.clientPhone} />
          <Field k="Date" v={docDate(head.date)} />
          <Field k="Flat No" v={head.flatNo} />
          <Field k="Location" v={head.location} />
          <Field k="Configuration" v={head.config} />
        </div>

        {props.welcomeNote ? <p className="qd-welcome">{props.welcomeNote}</p> : null}

        {rooms.length === 0 ? <p className="qd-empty">Nothing on this quotation yet.</p> : null}

        {rooms.map((room) => (
          <div key={room.room} className="qd-roomblock">
            <div className="qd-roomhdr">{room.room}</div>
            <table className="qd-tbl qd-room">
              <thead>
                <tr className="qd-cols">
                  <th>S.No.</th>
                  <th>Product</th>
                  <th>Work Code</th>
                  <th>Details</th>
                  <th className="r">Units</th>
                  <th className="r">Width(mm)</th>
                  <th className="r">Height(mm)</th>
                  <th className="r">Amount (₹)</th>
                  <th className="r">Discounted (₹)</th>
                </tr>
              </thead>
              <tbody>
                {room.rows.map((row) => (
                  <tr key={row.n}>
                    <td>{row.n}</td>
                    <td>
                      <b>{row.product}</b>
                    </td>
                    <td>{row.code}</td>
                    <td className="qd-details">
                      {row.details}
                      <LineNote text={row.note} />
                    </td>
                    <td className="r">{row.units}</td>
                    <td className="r">{row.widthMm ?? ''}</td>
                    <td className="r">{row.heightMm ?? ''}</td>
                    <td className={`r${row.modular ? ' qd-struck' : ''}`}>{n(row.amountPaise)}</td>
                    <td className={`r${row.modular ? ' qd-disc' : ' qd-soft'}`}>{n(row.discountedPaise)}</td>
                  </tr>
                ))}
                <tr className="qd-sub">
                  <td colSpan={7}>{room.room} (Sub-total)</td>
                  <td className="r">{n(room.subPaise)}</td>
                  <td className="r">{n(room.subDiscountedPaise)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        <DocSummary rooms={rooms} studio={studio} totals={totals} feeBps={props.feeBps} discountBps={props.discountBps} gstBps={props.gstBps} onSpotLabel={props.onSpotLabel} schedule={props.schedule} spec={props.spec} />

        {props.extra}

        <footer className="qd-foot">
          <p>
            Prices hold for {validDays} days, until {validUntil}. All figures in Indian rupees.
          </p>
          {studio ? (
            <p>
              {studio.name}
              {studio.gstin ? ` · GSTIN ${studio.gstin}` : ''}
            </p>
          ) : null}
          {/* Below their name and their GSTIN, outside the terms, at the
              smallest weight on the page (modules/studio-quote/mark.ts). */}
          {props.showMark ? <p className="qd-mark">{props.markText}</p> : null}
        </footer>
      </section>

      {props.terms?.trim() ? <TermsSheet studio={studio} terms={props.terms} /> : null}
    </DocFrame>
  );
}

/**
 * The closing pages of both PDFs — Hauspire's `QuoteSummary`: the summary
 * by room with its donut, the totals box, the payment stages with their End
 * Deliverables, and the material specification. The quotation ends with it,
 * and so does the Final (Original vs Revised), as the old app's did.
 */
export function DocSummary({
  rooms,
  studio,
  totals,
  feeBps,
  discountBps,
  gstBps,
  onSpotLabel,
  schedule,
  spec,
}: {
  rooms: DocRoom[];
  studio: DocStudio | null;
  totals: QuoteTotals;
  feeBps: number;
  discountBps: number;
  gstBps: number;
  onSpotLabel: string | null;
  schedule: PaymentStage[] | null;
  spec: DocSpecRow[];
}) {
  const shares = roomShares(rooms);
  const palette = donutPalette(studio?.accentHex ?? null, shares.length);
  const stages = docStages(schedule, totals);
  const gstOn = totals.gstPaise > 0;
  const workTotal = rooms.reduce((a, x) => a + x.subPaise, 0);
  return (
    <>
      {rooms.length > 0 ? (
        <div className="qd-keep qd-summary">
          <div className="qd-roomhdr">Summary By Room</div>
          <div className="qd-summary-grid">
            <table className="qd-tbl">
              <thead>
                <tr className="qd-cols">
                  <th>S.No.</th>
                  <th>Rooms</th>
                  <th className="r">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {shares.map((s, i) => (
                  <tr key={s.room}>
                    <td>{i + 1}</td>
                    <td>{s.room}</td>
                    <td className="r">{n(s.paise)}</td>
                  </tr>
                ))}
                <tr className="qd-sub">
                  <td colSpan={2}>Total</td>
                  <td className="r">{n(workTotal)}</td>
                </tr>
              </tbody>
            </table>
            <Donut shares={shares} palette={palette} />
          </div>
        </div>
      ) : null}

      <div className="qd-keep qd-totalsbox">
        <table className="qd-tbl qd-totals">
          <tbody>
            <Row k="Sum-Total (MO-01)  ·  Modular" v={n(totals.modularPaise)} />
            <Row k="Sum-Total (NM-01)  ·  Non-Modular" v={n(totals.onsitePaise)} />
            {totals.feePaise > 0 || feeBps > 0 ? <Row k={`Professional fees (${Math.round(feeBps / 100)}%)`} v={n(totals.feePaise)} /> : null}
            <Row k="Sub-Total" v={n(totals.subTotalPaise)} bold />
            <Row k={`Discount on Modular (${Math.round(discountBps / 100)}%)`} v={n(totals.discountPaise)} />
            {totals.onSpotPaise ? <Row k={`${onSpotLabel || DEFAULT_DISCOUNT_NAME} (₹)`} v={n(totals.onSpotPaise)} /> : null}
            {gstOn ? (
              <>
                <Row k="Total Project Value (before GST)" v={n(totals.beforeTaxPaise)} bold />
                <Row k={`GST (${Math.round(gstBps / 100)}%)`} v={n(totals.gstPaise)} />
                <tr className="qd-grand">
                  <td>Grand Total (incl. GST)</td>
                  <td className="r">{r(totals.totalPaise)}</td>
                </tr>
              </>
            ) : (
              <tr className="qd-grand">
                <td>Total Project Value</td>
                <td className="r">{r(totals.totalPaise)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {stages.length > 0 ? (
        <div className="qd-section">
          <div className="qd-roomhdr">Payment Stages{gstOn ? ' (incl. GST)' : ''}</div>
          <table className="qd-tbl qd-stages">
            <thead>
              <tr className="qd-cols">
                <th>Payment Stage</th>
                <th>End Deliverable</th>
                <th className="r">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s, i) => (
                <tr key={`${i}-${s.label}`}>
                  <td>
                    <b>{s.label}</b>
                  </td>
                  <td className="qd-deliv">
                    <Bold text={s.deliverable} />
                  </td>
                  <td className="r">{n(s.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="qd-note">{STAGES_NOTE}</p>
        </div>
      ) : null}

      {spec.length > 0 ? (
        <div className="qd-section">
          <div className="qd-roomhdr">Material Specification</div>
          <table className="qd-tbl qd-spec">
            <thead>
              <tr className="qd-cols">
                <th>Material</th>
                <th>Brand</th>
                <th>Specification</th>
              </tr>
            </thead>
            <tbody>
              {spec.map((x) => (
                <tr key={x.item}>
                  <td>
                    <b>{x.item}</b>
                  </td>
                  <td>{x.brand ?? ''}</td>
                  <td className="qd-specv">{x.spec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

function Row({ k, v, bold = false }: { k: string; v: string; bold?: boolean }) {
  return (
    <tr className={bold ? 'qd-strong' : undefined}>
      <td>{k}</td>
      <td className="r">{v}</td>
    </tr>
  );
}

/** The terms, on their own pages, under a running header (studio name · TERMS & CONDITIONS). */
export function TermsSheet({ studio, terms }: { studio: DocStudio | null; terms: string }) {
  const blocks = parseTerms(terms);
  return (
    <section className="qd-sheet qd-terms" aria-label="Terms and conditions">
      {/* A table, so the header repeats at the top of every printed page of the terms and only there. */}
      <table className="qd-terms-frame">
        <thead>
          <tr>
            <th>
              <div className="qd-runhead">
                <span className="qd-runname">{(studio?.tradeName || studio?.name || '').toUpperCase()}</span>
                <span className="qd-runlabel">Terms &amp; Conditions</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <TermsBody blocks={blocks} />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

/** The terms' blocks: headings, bullets and text, as the PDF and the Terms page preview show them. */
export function TermsBody({ blocks }: { blocks: ReturnType<typeof parseTerms> }) {
  return (
    <div className="qd-termsbody">
      {blocks.map((b, i) =>
        b.kind === 'gap' ? (
          <div key={i} className="qd-gap" />
        ) : b.kind === 'title' ? (
          <h2 key={i}>
            <Bold text={b.text} />
          </h2>
        ) : b.kind === 'heading' ? (
          <h3 key={i}>
            <Bold text={b.text} />
          </h3>
        ) : b.kind === 'bullet' ? (
          <p key={i} className={b.sub ? 'qd-bullet qd-subbullet' : 'qd-bullet'}>
            <Bold text={b.text} />
          </p>
        ) : (
          /* Hauspire's TermsView: any other line is sub-text under the bullet above it, indented and softer. */
          <p key={i} className="qd-termtext">
            <Bold text={b.text} />
          </p>
        ),
      )}
    </div>
  );
}

function Bold({ text }: { text: string }) {
  return (
    <>
      {boldSegments(text).map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))}
    </>
  );
}

function Field({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <p className="qd-field">
      <b>{k}:</b> <span>{v ?? ''}</span>
    </p>
  );
}

/** Summary by room as a donut with its legend: Hauspire's `RoomDonut`, element for element. */
function Donut({ shares, palette }: { shares: { room: string; paise: number; pct: number }[]; palette: string[] }) {
  const items = shares.map((s, i) => ({ ...s, colour: palette[i] ?? 'var(--qd-acc)' })).filter((s) => s.paise > 0);
  const total = items.reduce((a, s) => a + s.paise, 0) || 1;
  const cx = 70;
  const cy = 70;
  const rad = 52;
  const sw = 22;
  const C = 2 * Math.PI * rad;
  let acc = 0;
  return (
    <div className="qd-donut">
      <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="Share of each room">
        <circle cx={cx} cy={cy} r={rad} fill="none" stroke="#efe7e0" strokeWidth={sw} />
        {items.map((s) => {
          const len = (s.paise / total) * C;
          const seg = (
            <circle
              key={s.room}
              cx={cx}
              cy={cy}
              r={rad}
              fill="none"
              stroke={s.colour}
              strokeWidth={sw}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          acc += len;
          return seg;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" className="qd-donut-k">
          TOTAL
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="qd-donut-v">
          {r(total)}
        </text>
      </svg>
      <table className="qd-legend">
        <tbody>
          {items.map((s) => (
            <tr key={s.room}>
              <td>
                <span className="qd-swatch" style={{ background: s.colour }} />
              </td>
              <td className="qd-lname">{s.room}</td>
              <td className="r qd-lval">{r(s.paise)}</td>
              <td className="r qd-pct">{Math.round((s.paise / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
