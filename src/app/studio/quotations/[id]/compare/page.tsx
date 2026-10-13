import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { getQuote, quotesToCompare, STAGE_LABELS, totalsFor, type QuoteRow } from '@/modules/studio-quote/quotes';
import { quoteDocContext } from '@/modules/studio-quote/document-data';
import { docHead, quoteFileName } from '@/modules/studio-quote/document';
import { DocFrame, DocOpening } from '../../doc/QuotationDocument';
import { compareToIssued, type ChangeKind } from '@/modules/studio-quote/revision';
import { PrintButton } from '../print/PrintButton';
import { revisionPair } from '@/modules/studio-sales/revisions';
import { comparable, revisionLabel, type RevisionTotals } from '@/modules/studio-sales/revision-rules';
import '../../quotes.css';

export const metadata: Metadata = {
  title: 'Compare quotations',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const KIND: Record<Exclude<ChangeKind, 'UNCHANGED'>, { label: string; tone: string }> = {
  ADDED: { label: 'New', tone: 'good' },
  REMOVED: { label: 'Removed', tone: 'bad' },
  REPRICED: { label: 'Changed', tone: 'warn' },
};

const lineList = (q: QuoteRow) => q.lines.map((l) => ({ room: l.room, product: l.product, amountPaise: l.amountPaise }));

/**
 * Original against revised: the Sales Final a client agreed to, and the
 * Design Final the work is built against — Hauspire's "Final (Original vs
 * Revised)". Every line that is new, changed or removed, room by room, and
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
  let wasLines: { room: string; product: string; amountPaise: number }[];
  let nowLines: { room: string; product: string; amountPaise: number }[];
  let was: Pick<RevisionTotals, 'workPaise' | 'feePaise' | 'discountPaise' | 'onSpotPaise' | 'gstPaise' | 'totalPaise'>;
  let now: typeof was;

  if (a !== undefined && b !== undefined) {
    const revs = await revisionPair(id, Number(a), Number(b));
    if (!revs) notFound();
    left = revisionLabel(revs.a.n);
    right = revisionLabel(revs.b.n);
    title = `${revs.clientName} — ${revs.number} ${left} vs ${right}`;
    wasLines = comparable(revs.a.lines);
    nowLines = comparable(revs.b.lines);
    was = revs.a.totals;
    now = revs.b.totals;
  } else {
    const pair = await quotesToCompare(id, withId);
    if (!pair) notFound();
    const { base, current } = pair;
    left = base.number;
    right = current.number;
    title = `${current.clientName} — ${STAGE_LABELS[base.stage]} vs ${STAGE_LABELS[current.stage]}`;
    wasLines = lineList(base);
    nowLines = lineList(current);
    was = totalsFor(base);
    now = totalsFor(current);
  }

  const summary = compareToIssued(wasLines, nowLines);
  const moved = summary.changes.filter((c) => c.kind !== 'UNCHANGED');
  const rooms = [...new Set(moved.map((c) => c.room))];

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
            {summary.identical
              ? 'No line has changed.'
              : `${summary.addedCount} new, ${summary.repricedCount} changed, ${summary.removedCount} removed.`}
          </p>

          {rooms.map((room) => (
            <table key={room} className="qd-tbl qd-room">
              <colgroup>
                <col style={{ width: '14%' }} />
                <col />
                <col style={{ width: '30%' }} />
                <col style={{ width: '18%' }} />
              </colgroup>
              <thead>
                <tr className="qd-band">
                  <th colSpan={4}>{room}</th>
                </tr>
                <tr className="qd-cols">
                  <th style={{ width: '14%' }}>Change</th>
                  <th>Product</th>
                  <th className="r" style={{ width: '30%' }}>
                    {left} → {right} (₹)
                  </th>
                  <th className="r" style={{ width: '18%' }}>
                    Difference (₹)
                  </th>
                </tr>
              </thead>
              <tbody>
                {moved
                  .filter((c) => c.room === room)
                  .map((c) => {
                    const k = KIND[c.kind as Exclude<ChangeKind, 'UNCHANGED'>];
                    return (
                      <tr key={`${c.room}|${c.product}`}>
                        <td className={k.tone === 'good' ? 'qd-disc' : k.tone === 'bad' ? 'qd-soft' : 'qd-product'}>{k.label}</td>
                        <td className="qd-product">{c.product}</td>
                        <td className="r">
                          {c.wasPaise > 0 ? formatINR(c.wasPaise, { symbol: false }) : '—'} → {c.nowPaise > 0 ? formatINR(c.nowPaise, { symbol: false }) : '—'}
                        </td>
                        <td className="r">
                          {c.deltaPaise > 0 ? '+' : '−'} {formatINR(Math.abs(c.deltaPaise), { symbol: false })}
                        </td>
                      </tr>
                    );
                  })}
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
