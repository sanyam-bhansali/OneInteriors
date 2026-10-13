import type { CSSProperties, ReactNode } from 'react';
import { formatINR } from '@/lib/money';
import type { QuoteTotals } from '@/modules/studio-quote/pricing';
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
  specHasBrands,
  type DocHead,
  type DocLineInput,
  type DocSpecRow,
  type DocStudio,
} from '@/modules/studio-quote/document';
import './quote-doc.css';

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
 * Print styles live in quote-doc.css; the studio's own colour (Settings,
 * checked by `safeAccent`) draws the bands, the sample's maroon being
 * Hauspire's.
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

const n = (paise: number) => formatINR(paise, { symbol: false });

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
  const shares = roomShares(rooms);
  const palette = donutPalette(studio?.accentHex ?? null, shares.length);
  const stages = docStages(props.schedule, totals);
  const brands = specHasBrands(props.spec);
  const gstOn = totals.gstPaise > 0;
  const workTotal = rooms.reduce((a, r) => a + r.subPaise, 0);
  const validDays = props.validDays ?? 30;
  const validUntil = docDate(new Date(new Date(head.date).getTime() + validDays * 86_400_000));

  return (
    <DocFrame accentHex={studio?.accentHex ?? null} embedded={props.embedded}>
      <DocOpening studio={studio} brandPages={props.brandPages} head={head} />

      <section className="qd-sheet qd-quote" aria-label="Quotation">
        <div className="qd-head">
          <div>
            <Field k="Client Name" v={head.clientName} />
            <Field k="Client Mobile" v={head.clientPhone} />
            <Field k="Flat No" v={head.flatNo} />
            <Field k="Configuration" v={head.config} />
          </div>
          <div>
            <Field k="Quotation No" v={head.number} />
            <Field k="Date" v={docDate(head.date)} />
            <Field k="Location" v={head.location} />
          </div>
        </div>

        {props.welcomeNote ? <p className="qd-welcome">{props.welcomeNote}</p> : null}

        {rooms.length === 0 ? <p className="qd-empty">Nothing on this quotation yet.</p> : null}

        {rooms.map((r) => (
          <table key={r.room} className="qd-tbl qd-room">
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '7.5%' }} />
              <col style={{ width: '22.5%' }} />
              <col style={{ width: '6.5%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '11.5%' }} />
            </colgroup>
            <thead>
              <tr className="qd-band">
                <th colSpan={9}>{r.room}</th>
              </tr>
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
              {r.rows.map((row) => (
                <tr key={row.n}>
                  <td>{row.n}</td>
                  <td className="qd-product">{row.product}</td>
                  <td>{row.code}</td>
                  <td className="qd-details">{row.details}</td>
                  <td className="r">{row.units}</td>
                  <td className="r">{row.widthMm ?? ''}</td>
                  <td className="r">{row.heightMm ?? ''}</td>
                  <td className={`r${row.modular ? ' qd-struck' : ''}`}>{row.amountPaise > 0 ? n(row.amountPaise) : '—'}</td>
                  <td className={`r${row.modular ? ' qd-disc' : ''}`}>{row.discountedPaise > 0 ? n(row.discountedPaise) : '—'}</td>
                </tr>
              ))}
              <tr className="qd-sub">
                <td colSpan={7}>{r.room} (Sub-total)</td>
                <td className="r">{n(r.subPaise)}</td>
                <td className="r">{n(r.subDiscountedPaise)}</td>
              </tr>
            </tbody>
          </table>
        ))}

        {rooms.length > 0 ? (
          <div className="qd-keep qd-summary">
            <p className="qd-bandline">Summary By Room</p>
            <div className="qd-summary-grid">
              <table className="qd-tbl">
                <colgroup>
                  <col style={{ width: '20%' }} />
                  <col />
                  <col style={{ width: '34%' }} />
                </colgroup>
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
              <Donut shares={shares} palette={palette} total={workTotal} />
            </div>
          </div>
        ) : null}

        <table className="qd-tbl qd-totals qd-keep">
          <tbody>
            <tr>
              <td>Sum-Total (MO-01) · Modular</td>
              <td className="r">{n(totals.modularPaise)}</td>
            </tr>
            <tr>
              <td>Sum-Total (NM-01) · Non-Modular</td>
              <td className="r">{n(totals.onsitePaise)}</td>
            </tr>
            {totals.feePaise > 0 ? (
              <tr>
                <td>Professional fees ({props.feeBps / 100}%)</td>
                <td className="r">{n(totals.feePaise)}</td>
              </tr>
            ) : null}
            <tr className="qd-strong">
              <td>Sub-Total</td>
              <td className="r">{n(totals.subTotalPaise)}</td>
            </tr>
            {totals.discountPaise > 0 ? (
              <tr>
                <td>Discount on Modular ({props.discountBps / 100}%)</td>
                <td className="r">{n(totals.discountPaise)}</td>
              </tr>
            ) : null}
            {totals.onSpotPaise > 0 ? (
              <tr>
                <td>{props.onSpotLabel || 'Additional discount'}</td>
                <td className="r">{n(totals.onSpotPaise)}</td>
              </tr>
            ) : null}
            {gstOn ? (
              <>
                <tr className="qd-strong">
                  <td>Total Project Value (before GST)</td>
                  <td className="r">{n(totals.beforeTaxPaise)}</td>
                </tr>
                <tr>
                  <td>GST ({props.gstBps / 100}%)</td>
                  <td className="r">{n(totals.gstPaise)}</td>
                </tr>
                <tr className="qd-grand">
                  <td>Grand Total (incl. GST)</td>
                  <td className="r">{formatINR(totals.totalPaise)}</td>
                </tr>
              </>
            ) : (
              <tr className="qd-grand">
                <td>Total Project Value</td>
                <td className="r">{formatINR(totals.totalPaise)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {stages.length > 0 ? (
          <div className="qd-keep">
            <table className="qd-tbl qd-stages">
              <colgroup>
                <col style={{ width: '27%' }} />
                <col />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr className="qd-band">
                  <th colSpan={3}>Payment Stages{gstOn ? ' (incl. GST)' : ''}</th>
                </tr>
                <tr className="qd-cols">
                  <th style={{ width: '27%' }}>Payment Stage</th>
                  <th>End Deliverable</th>
                  <th className="r" style={{ width: '13%' }}>
                    Amount (₹)
                  </th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s, i) => (
                  <tr key={`${i}-${s.label}`}>
                    <td className="qd-product">{s.label}</td>
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

        {props.spec.length > 0 ? (
          <table className="qd-tbl qd-spec">
            {brands ? (
              <colgroup>
                <col style={{ width: '24%' }} />
                <col style={{ width: '28%' }} />
                <col />
              </colgroup>
            ) : (
              <colgroup>
                <col style={{ width: '30%' }} />
                <col />
              </colgroup>
            )}
            <thead>
              <tr className="qd-band">
                <th colSpan={brands ? 3 : 2}>Material Specification</th>
              </tr>
              <tr className="qd-cols">
                <th style={{ width: brands ? '24%' : '30%' }}>Material</th>
                {brands ? <th style={{ width: '27%' }}>Brand</th> : null}
                <th>Specification</th>
              </tr>
            </thead>
            <tbody>
              {props.spec.map((r) => (
                <tr key={r.item}>
                  <td className="qd-product">{r.item}</td>
                  {brands ? <td>{r.brand ?? ''}</td> : null}
                  <td className="qd-soft">{r.spec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

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
          <p key={i} className="qd-bullet">
            <Bold text={b.text} />
          </p>
        ) : (
          <p key={i}>
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

/** Summary by room as a donut with its legend (Hauspire's RoomDonut). */
function Donut({ shares, palette, total }: { shares: { room: string; paise: number; pct: number }[]; palette: string[]; total: number }) {
  const items = shares.filter((s) => s.paise > 0);
  const sum = items.reduce((a, s) => a + s.paise, 0) || 1;
  const cx = 70;
  const cy = 70;
  const r = 52;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="qd-donut">
      <svg viewBox="0 0 140 140" width="132" height="132" role="img" aria-label="Share of each room">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--qd-tint)" strokeWidth={22} />
        {items.map((s) => {
          const len = (s.paise / sum) * C;
          const seg = (
            <circle
              key={s.room}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={palette[shares.indexOf(s)] ?? 'var(--qd-acc)'}
              strokeWidth={22}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          acc += len;
          return seg;
        })}
        <text x={cx} y={cy - 3} textAnchor="middle" className="qd-donut-k">
          TOTAL
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="qd-donut-v">
          {formatINR(total)}
        </text>
      </svg>
      <table className="qd-legend">
        <tbody>
          {shares.map((s, i) => (
            <tr key={s.room}>
              <td>
                <span className="qd-swatch" style={{ background: palette[i] }} />
              </td>
              <td>{s.room}</td>
              <td className="r">{formatINR(s.paise)}</td>
              <td className="r qd-pct">{s.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
