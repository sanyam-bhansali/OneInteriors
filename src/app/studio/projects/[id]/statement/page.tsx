import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { projectStatement } from '@/modules/project/statement';
import type { StatementOrder } from '@/modules/project/statement-rules';
import { nameWord } from '@/modules/studio-design/documents';
import { PrintStatement } from './PrintStatement';

export const metadata: Metadata = { title: 'Statement', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The project statement (owner, 13 Nov 2026: "first the quotation, after it
 * ends the electrical one, then the additional items in their format, then
 * the total, paid and remaining"). One page to print or save as a PDF; the
 * figures are the payment ledger's, the same as the Payments tab
 * (project/statement-rules.ts).
 */

const cell = 'border-b border-[#e5e5e5] px-2 py-1.5 align-top';
const head = 'border-b border-[#999] px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#555]';
const num = 'mono text-right whitespace-nowrap';
const signed = (p: number) => `${p < 0 ? '−' : ''}${formatINR(Math.abs(p))}`;

function Orders({ title, orders, note }: { title: string; orders: StatementOrder[]; note?: string }) {
  if (orders.length === 0) return null;
  const sum = (k: 'amountPaise' | 'paidPaise' | 'remainingPaise') => orders.reduce((n, o) => n + o[k], 0);
  return (
    <section className="break-inside-avoid">
      <h2 className="m-0 mt-6 text-[16px] font-semibold">{title}</h2>
      {note ? <p className="m-0 mt-1 text-[12.5px] text-[#555]">{note}</p> : null}
      {orders.map((o) => (
        <div key={o.id} className="mt-3 break-inside-avoid">
          <p className="m-0 text-[14px] font-semibold">
            <span className="mono">{o.number}</span> · {o.title} <span className="font-normal text-[#555]">· {o.paidLabel}</span>
          </p>
          <table className="mt-1 w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={head}>Room</th>
                <th className={head}>Item</th>
                <th className={`${head} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {o.lines.map((x, i) => (
                <tr key={i}>
                  <td className={cell}>{x.room || 'Whole home'}</td>
                  <td className={cell}>{x.product}</td>
                  <td className={`${cell} ${num}`}>{formatINR(x.amountPaise)}</td>
                </tr>
              ))}
              <tr>
                <td className={cell} colSpan={2}>
                  <b>Total (GST included)</b>
                  {o.paidPaise > 0 || o.waitingPaise > 0 ? (
                    <span className="text-[#555]">
                      {' '}
                      · paid {formatINR(o.paidPaise)}
                      {o.waitingPaise > 0 ? ` · ${formatINR(o.waitingPaise)} waiting for confirmation` : ''}
                    </span>
                  ) : null}
                </td>
                <td className={`${cell} ${num} font-semibold`}>{formatINR(o.amountPaise)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
      {orders.length > 1 ? (
        <p className="m-0 mt-2 text-right text-[13px]">
          {title}: <b className="mono">{formatINR(sum('amountPaise'))}</b> · paid <span className="mono">{formatINR(sum('paidPaise'))}</span> · remaining{' '}
          <span className="mono">{formatINR(sum('remainingPaise'))}</span>
        </p>
      ) : null}
    </section>
  );
}

export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await projectStatement(id);
  if (!view) notFound();
  const s = view.statement;
  const filename = `Statement_${nameWord(view.client, 'Client')}_${nameWord(view.studio, 'Studio')}_${view.on}`;
  const day = new Date(`${view.on}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

  return (
    <main className="px-4 py-6">
      <PrintStatement filename={filename} backHref={`/studio/projects/${id}?tab=payments`} />
      <article className="mx-auto max-w-[820px] rounded-[12px] bg-white p-6 text-[#111] shadow-sm print:p-0 print:shadow-none" data-testid="statement">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#111] pb-3">
          <div>
            <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#555]">{view.studio}</p>
            <h1 className="m-0 text-[22px] font-semibold">Statement of account</h1>
            <p className="m-0 mt-1 text-[14px]">
              {view.client} · {view.home}
            </p>
          </div>
          <p className="m-0 text-[13px] text-[#555]">As on {day}</p>
        </header>

        <section className="break-inside-avoid">
          <h2 className="m-0 mt-5 text-[16px] font-semibold">Quotation{s.quotation.number ? <span className="mono font-normal"> {s.quotation.number}</span> : null}</h2>
          <table className="mt-2 w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={head}>Payment stage</th>
                <th className={`${head} text-right`}>As signed</th>
                <th className={`${head} text-right`}>Owed now</th>
                <th className={`${head} text-right`}>Paid</th>
                <th className={`${head} text-right`}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {s.quotation.stages.map((st, i) => (
                <tr key={i}>
                  <td className={cell}>
                    {st.label}
                    {st.pct !== null ? <span className="text-[#555]"> · {st.pct}%</span> : null}
                  </td>
                  <td className={`${cell} ${num}`}>{formatINR(st.signedPaise)}</td>
                  <td className={`${cell} ${num}`}>{formatINR(st.owedPaise)}</td>
                  <td className={`${cell} ${num}`}>{formatINR(st.paidPaise)}</td>
                  <td className={`${cell} ${num}`}>{formatINR(st.remainingPaise)}</td>
                </tr>
              ))}
              <tr>
                <td className={`${cell} font-semibold`}>Quotation total (GST included)</td>
                <td className={`${cell} ${num} font-semibold`}>{formatINR(s.quotation.signedPaise)}</td>
                <td className={cell} colSpan={3} />
              </tr>
            </tbody>
          </table>
          <p className="m-0 mt-1 text-[12px] text-[#555]">&ldquo;Owed now&rdquo; includes the extra work and changes below, which land on the last stage.</p>
        </section>

        <Orders title="Electrical" orders={s.electrical} />
        <Orders title="Additional items" orders={s.additional} note="Extra work agreed after the design was signed off, paid in full before the work." />

        {s.otherChanges.length ? (
          <section className="break-inside-avoid">
            <h2 className="m-0 mt-6 text-[16px] font-semibold">Other changes</h2>
            <table className="mt-2 w-full border-collapse text-[13px]">
              <tbody>
                {s.otherChanges.map((c, i) => (
                  <tr key={i}>
                    <td className={cell}>{c.label}</td>
                    <td className={`${cell} ${num}`}>{signed(c.deltaPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="mt-6 break-inside-avoid border-t border-[#111] pt-3">
          <table className="ml-auto w-full max-w-[360px] border-collapse text-[14px]">
            <tbody>
              <tr>
                <td className="py-1">Total</td>
                <td className={`py-1 ${num} font-semibold`}>{formatINR(s.totals.totalPaise)}</td>
              </tr>
              <tr>
                <td className="py-1">Paid</td>
                <td className={`py-1 ${num}`}>{formatINR(s.totals.paidPaise)}</td>
              </tr>
              {s.totals.waitingPaise > 0 ? (
                <tr>
                  <td className="py-1 text-[#555]">Recorded, waiting for confirmation</td>
                  <td className={`py-1 ${num} text-[#555]`}>{formatINR(s.totals.waitingPaise)}</td>
                </tr>
              ) : null}
              <tr>
                <td className="border-t border-[#111] py-1 font-semibold">Remaining</td>
                <td className={`border-t border-[#111] py-1 ${num} font-semibold`}>{formatINR(s.totals.remainingPaise)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {s.pending.length ? (
          <section className="mt-6 break-inside-avoid">
            <h2 className="m-0 text-[14px] font-semibold">Sent, not approved yet (not in the total)</h2>
            <ul className="m-0 mt-1 pl-5 text-[13px]">
              {s.pending.map((o) => (
                <li key={o.id}>
                  <span className="mono">{o.number}</span> · {o.title}: {formatINR(o.amountPaise)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </main>
  );
}
