import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { quotesToCompare, STAGE_LABELS, totalsFor, type QuoteRow } from '@/modules/studio-quote/quotes';
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

  return (
    <main className="content qpage">
      <div className="phead">
        <div style={{ minWidth: 0 }}>
          <h1>{title}</h1>
          <p className="muted qsub mono">
            {left} → {right}
          </p>
        </div>
        <PrintButton filename={`${title} ${left} vs ${right}`} />
      </div>

      <section className="card flush">
        <div className="tscroll">
          <table className="tbl" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Figure</span>
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  {left}
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  {right}
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Difference
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, a, b]) => (
                <tr key={label} style={label === 'Total' ? { fontWeight: 600 } : undefined}>
                  <td>{label}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {money(a)}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {money(b)}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {b - a === 0 ? '—' : `${b - a > 0 ? '+' : '−'} ${formatINR(Math.abs(b - a))}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="muted" style={{ margin: 0 }}>
        {summary.identical
          ? 'No line has changed.'
          : `${summary.addedCount} new, ${summary.repricedCount} changed, ${summary.removedCount} removed.`}
      </p>

      {rooms.map((room) => (
        <section key={room} className="card flush">
          <div className="chead">
            <h2>{room}</h2>
          </div>
          <div className="tscroll">
            <table className="tbl" style={{ minWidth: 560 }}>
              <tbody>
                {moved
                  .filter((c) => c.room === room)
                  .map((c) => {
                    const k = KIND[c.kind as Exclude<ChangeKind, 'UNCHANGED'>];
                    return (
                      <tr key={`${c.room}|${c.product}`}>
                        <td style={{ width: 110 }}>
                          <span className={`chip ${k.tone}`}>{k.label}</span>
                        </td>
                        <td>{c.product}</td>
                        <td className="mono muted" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {c.wasPaise > 0 ? formatINR(c.wasPaise) : '—'} → {c.nowPaise > 0 ? formatINR(c.nowPaise) : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 500, width: 140 }}>
                          {c.deltaPaise > 0 ? '+' : '−'} {formatINR(Math.abs(c.deltaPaise))}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}
