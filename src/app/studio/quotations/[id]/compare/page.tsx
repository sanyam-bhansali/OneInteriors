import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { getQuote, quotesToCompare, STAGE_LABELS, totalsFor } from '@/modules/studio-quote/quotes';
import { quoteDocContext } from '@/modules/studio-quote/document-data';
import { docHead, quoteFileName } from '@/modules/studio-quote/document';
import { DocFrame, DocOpening, LineNote } from '../../doc/QuotationDocument';
import { changeSentence, deltaText, finalCounts, finalRooms, withKnownDetails, type FinalKind, type FinalLineInput } from '@/modules/studio-quote/final-doc';
import { roomsOfLines } from '@/modules/studio-quote/rooms';
import { PrintButton } from '../print/PrintButton';
import { revisionPair } from '@/modules/studio-sales/revisions';
import { revisionLabel, type RevisionTotals } from '@/modules/studio-sales/revision-rules';
import '../../quotes.css';

export const metadata: Metadata = {
  title: 'Compare quotations',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const TAG: Record<FinalKind, string> = { ADDED: 'New', REMOVED: 'Removed', CHANGED: 'Changed', UNCHANGED: '' };
const ROW_CLASS: Record<FinalKind, string | undefined> = { ADDED: 'qd-added', REMOVED: 'qd-removed', CHANGED: 'qd-changed', UNCHANGED: undefined };

const n = (paise: number) => formatINR(paise, { symbol: false });
const diff = (paise: number) => (paise === 0 ? '—' : `${paise > 0 ? '+' : '−'} ${formatINR(Math.abs(paise), { symbol: false })}`);

/**
 * Original against revised: the Sales Final a client agreed to, and the
 * Design Final the work is built against — Hauspire's "Final (Original vs
 * Revised)". Every line of both, room by room, with its work code, details,
 * note and size before → after, what was added or removed, and
 * what it does to the total. Printable, because it is the page a client
 * signs the difference on.
 *
 * `?with=<id>` compares against any other quotation of this studio instead.
 *
 * `?a=1&b=3` (Studio OS Phase 1) compares two sent revisions of this one
 * quotation — R1 against R3 — with the same table and the same list.
 */
export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ with?: string; a?: string; b?: string }>;
}) {
  const [{ id }, { with: withId, a, b }] = await Promise.all([params, searchParams]);

  let title: string;
  let left: string;
  let right: string;
  let wasLines: FinalLineInput[];
  let nowLines: FinalLineInput[];
  let was: Pick<RevisionTotals, 'workPaise' | 'feePaise' | 'discountPaise' | 'onSpotPaise' | 'gstPaise' | 'totalPaise'>;
  let now: typeof was;

  if (a !== undefined && b !== undefined) {
    const revs = await revisionPair(id, Number(a), Number(b));
    if (!revs) notFound();
    left = revisionLabel(revs.a.n);
    right = revisionLabel(revs.b.n);
    title = `${revs.clientName} — ${revs.number} ${left} vs ${right}`;
    wasLines = revs.a.lines;
    nowLines = revs.b.lines;
    was = revs.a.totals;
    now = revs.b.totals;
  } else {
    const pair = await quotesToCompare(id, withId);
    if (!pair) notFound();
    const { base, current } = pair;
    left = base.number;
    right = current.number;
    title = `${current.clientName} — ${STAGE_LABELS[base.stage]} vs ${STAGE_LABELS[current.stage]}`;
    wasLines = base.lines;
    nowLines = current.lines;
    was = totalsFor(base);
    now = totalsFor(current);
  }

  const money = (paise: number) => (paise < 0 ? `− ${formatINR(-paise)}` : formatINR(paise));
  const rows: [string, number, number][] = [
    ['Work, all lines', was.workPaise, now.workPaise],
    ['Professional fee', was.feePaise, now.feePaise],
    ['Discounts', -(was.discountPaise + was.onSpotPaise), -(now.discountPaise + now.onSpotPaise)],
    ...(was.gstPaise > 0 || now.gstPaise > 0 ? ([['GST', was.gstPaise, now.gstPaise]] as [string, number, number][]) : []),
    ['Total', was.totalPaise, now.totalPaise],
  ];

  /* The same opening pages and styling as the quotation PDF (owner, 13 Oct
     2026): the studio's brand pages, or the drawn cover, then this page's
     own content, Original against Revised. */
  const current = await getQuote(id);
  const ctx = current ? await quoteDocContext(current) : null;
  const head = current ? docHead(current, ctx?.branding?.city ?? null) : null;

  /* Every line of both sides, room by room, with its work code, details,
     note and size before → after (owner's team, 15 Oct 2026). A frozen side
     without details shows the quotation's own for the same room and
     product, so nothing that is known prints blank. */
  const known = current?.lines ?? [];
  const rooms = finalRooms(withKnownDetails(wasLines, known), withKnownDetails(nowLines, known), roomsOfLines(nowLines));
  const counts = finalCounts(rooms);
  const sentences = rooms.flatMap((r) => r.rows.map((row) => changeSentence(r.room, row)).filter((t): t is string => t !== null));
  const studioName = ctx?.studio?.tradeName || ctx?.branding?.legalName || '';

  return (
    <>
      <PrintButton
        filename={current ? quoteFileName(current.clientName, studioName, `${current.number} ${left} vs ${right}`, current.quoteDate, true) : `${title} ${left} vs ${right}`}
      />
      <DocFrame accentHex={ctx?.studio?.accentHex ?? null}>
        {head ? <DocOpening studio={ctx?.studio ?? null} brandPages={ctx?.brandPages ?? []} head={head} final /> : null}

        <section className="qd-sheet qd-quote" aria-label="Original vs Revised">
          {head ? (
            <div className="qd-head">
              <div>
                <p className="qd-field">
                  <b>Client Name:</b> <span>{head.clientName}</span>
                </p>
                <p className="qd-field">
                  <b>Client Mobile:</b> <span>{head.clientPhone ?? ''}</span>
                </p>
                <p className="qd-field">
                  <b>Configuration:</b> <span>{head.config ?? ''}</span>
                </p>
              </div>
              <div>
                <p className="qd-field">
                  <b>Quotation No:</b> <span>{head.number}</span>
                </p>
                <p className="qd-field">
                  <b>Compared:</b> <span>{title}</span>
                </p>
                <p className="qd-field">
                  <b>Location:</b> <span>{head.location ?? ''}</span>
                </p>
              </div>
            </div>
          ) : null}

          <table className="qd-tbl qd-keep">
            <colgroup>
              <col style={{ width: '34%' }} />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr className="qd-band">
                <th colSpan={4}>
                  Final (Original vs Revised) · {left} → {right}
                </th>
              </tr>
              <tr className="qd-cols">
                <th style={{ width: '34%' }}>Figure</th>
                <th className="r">{left}</th>
                <th className="r">{right}</th>
                <th className="r">Difference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, a, b]) => (
                <tr key={label} className={label === 'Total' ? 'qd-sub' : undefined}>
                  <td>{label}</td>
                  <td className="r">{money(a)}</td>
                  <td className="r">{money(b)}</td>
                  <td className="r">{b - a === 0 ? '—' : `${b - a > 0 ? '+' : '−'} ${formatINR(Math.abs(b - a))}`}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="qd-note">
            {counts.added + counts.changed + counts.removed === 0
              ? 'No line has changed.'
              : `${counts.added} new, ${counts.changed} changed, ${counts.removed} removed · total ${deltaText(now.totalPaise - was.totalPaise)}.`}
          </p>

          {sentences.length > 0 ? (
            <div className="qd-keep">
              <p className="qd-bandline">What changed</p>
              <ul className="qd-changes">
                {sentences.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {rooms.map((r) => (
            <table key={r.room} className="qd-tbl qd-room qd-final">
              <colgroup>
                <col style={{ width: '6%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '23%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
              </colgroup>
              <thead>
                <tr className="qd-band">
                  <th colSpan={8}>{r.room}</th>
                </tr>
                <tr className="qd-cols">
                  <th>S.No.</th>
                  <th>Product</th>
                  <th>Work Code</th>
                  <th>Details</th>
                  <th>Size / Units</th>
                  <th className="r">{left} (₹)</th>
                  <th className="r">{right} (₹)</th>
                  <th className="r">Difference (₹)</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.n} className={ROW_CLASS[row.kind]}>
                    <td>{row.n}</td>
                    <td className="qd-product">
                      {row.product}
                      {row.kind !== 'UNCHANGED' ? (
                        <>
                          <br />
                          <span className={`qd-tag qd-tag-${row.kind.toLowerCase()}`}>{TAG[row.kind]}</span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {row.codeWas ? (
                        <>
                          <span className="qd-was">{row.codeWas}</span>
                          <span className="qd-arrow">→</span>
                          <span className="qd-now">{row.code}</span>
                        </>
                      ) : (
                        row.code
                      )}
                    </td>
                    <td className="qd-details">
                      {row.details}
                      {row.detailsWas !== null ? <span className="qd-detwas">{row.detailsWas || '(no details)'}</span> : null}
                      <LineNote text={row.note} />
                    </td>
                    <td>
                      {row.kind === 'CHANGED' && row.sizeChanged ? (
                        <>
                          <span className="qd-was qd-sz">{row.sizeWas || '—'}</span>
                          <span className="qd-now qd-sz">
                            <span className="qd-arrow">→</span>
                            {row.sizeNow || '—'}
                          </span>
                        </>
                      ) : (
                        row.sizeNow || row.sizeWas
                      )}
                    </td>
                    <td className="r">{row.kind === 'ADDED' ? '—' : n(row.wasPaise)}</td>
                    <td className="r">{row.kind === 'REMOVED' ? '—' : n(row.nowPaise)}</td>
                    <td className={`r ${row.deltaPaise > 0 ? 'qd-up' : row.deltaPaise < 0 ? 'qd-down' : 'qd-same'}`}>{diff(row.deltaPaise)}</td>
                  </tr>
                ))}
                <tr className="qd-sub">
                  <td colSpan={5}>{r.room} (Sub-total)</td>
                  <td className="r">{n(r.wasPaise)}</td>
                  <td className="r">{n(r.nowPaise)}</td>
                  <td className="r">{diff(r.deltaPaise)}</td>
                </tr>
              </tbody>
            </table>
          ))}

          {ctx?.studio ? (
            <footer className="qd-foot">
              <p>
                {ctx.studio.name}
                {ctx.studio.gstin ? ` · GSTIN ${ctx.studio.gstin}` : ''}
              </p>
              {ctx.showMark ? <p className="qd-mark">{ctx.markText}</p> : null}
            </footer>
          ) : null}
        </section>
      </DocFrame>
    </>
  );
}
