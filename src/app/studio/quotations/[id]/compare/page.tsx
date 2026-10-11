import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../../../StudioShell';
import { formatINR } from '@/lib/money';
import { quotesToCompare, STAGE_LABELS, totalsFor, type QuoteRow } from '@/modules/studio-quote/quotes';
import { compareToIssued, type ChangeKind } from '@/modules/studio-quote/revision';
import { PrintButton } from '../print/PrintButton';
import { revisionPair } from '@/modules/studio-sales/revisions';
import { comparable, revisionLabel, type RevisionTotals } from '@/modules/studio-sales/revision-rules';

export const metadata: Metadata = {
  title: 'Compare quotations',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const KIND: Record<Exclude<ChangeKind, 'UNCHANGED'>, { label: string; tone: string }> = {
  ADDED: { label: 'New', tone: '!bg-[var(--s-good-wash)] !text-[var(--s-good)]' },
  REMOVED: { label: 'Removed', tone: '!bg-[var(--s-bad-wash)] !text-[var(--s-bad)]' },
  REPRICED: { label: 'Changed', tone: '!bg-[var(--s-warn-wash)] !text-[var(--s-warn)]' },
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
    <>
      <PageHead
        title={title}
        sub={
          <span className="s-num">
            {left} → {right}
          </span>
        }
        action={<PrintButton filename={`${title} ${left} vs ${right}`} />}
      />
      <PageBody>
        <div className="flex flex-col gap-5">
          <section className="s-card overflow-hidden">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="bg-[var(--s-surface-2)] text-left">
                  <th className="px-4 py-2.5 font-medium" />
                  <th className="px-4 py-2.5 text-right font-medium">{left}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{right}</th>
                  <th className="px-4 py-2.5 text-right font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, a, b]) => (
                  <tr key={label} className={`border-t border-[var(--s-rule-soft)] ${label === 'Total' ? 'font-semibold' : ''}`}>
                    <td className="px-4 py-2.5">{label}</td>
                    <td className="s-num px-4 py-2.5 text-right">{money(a)}</td>
                    <td className="s-num px-4 py-2.5 text-right">{money(b)}</td>
                    <td className="s-num px-4 py-2.5 text-right">
                      {b - a === 0 ? '—' : `${b - a > 0 ? '+' : '−'} ${formatINR(Math.abs(b - a))}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="m-0 text-[14px] text-[var(--s-ink-2)]">
            {summary.identical
              ? 'No line has changed.'
              : `${summary.addedCount} new, ${summary.repricedCount} changed, ${summary.removedCount} removed.`}
          </p>

          {rooms.map((room) => (
            <section key={room} className="s-card overflow-hidden">
              <h2 className="m-0 bg-[var(--s-accent)] px-4 py-2 text-[13.5px] font-semibold uppercase tracking-[0.06em] text-white">
                {room}
              </h2>
              <ul className="m-0 flex list-none flex-col p-0">
                {moved
                  .filter((c) => c.room === room)
                  .map((c) => {
                    const k = KIND[c.kind as Exclude<ChangeKind, 'UNCHANGED'>];
                    return (
                      <li
                        key={`${c.room}|${c.product}`}
                        className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[var(--s-rule-soft)] px-4 py-2.5 last:border-b-0"
                      >
                        <span className={`s-tag flex-none ${k.tone}`}>{k.label}</span>
                        <span className="min-w-0 flex-1 text-[14px]">{c.product}</span>
                        <span className="s-num text-[13.5px] text-[var(--s-ink-3)]">
                          {c.wasPaise > 0 ? formatINR(c.wasPaise) : '—'} → {c.nowPaise > 0 ? formatINR(c.nowPaise) : '—'}
                        </span>
                        <span className="s-num w-[7.5rem] text-right text-[13.5px] font-medium">
                          {c.deltaPaise > 0 ? '+' : '−'} {formatINR(Math.abs(c.deltaPaise))}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
      </PageBody>
    </>
  );
}
