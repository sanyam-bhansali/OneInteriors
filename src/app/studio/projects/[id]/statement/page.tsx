import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { projectStatement } from '@/modules/project/statement';
import type { StatementOrder } from '@/modules/project/statement-rules';
import { nameWord } from '@/modules/studio-design/documents';
import { PrintStatement } from './PrintStatement';
import { DocFooter, DocHeader, PaymentNote, SignBlock, longDay } from '../MoneyDoc';

export const metadata: Metadata = { title: 'Statement', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The project statement (owner, 13 Nov 2026: "first the quotation, after it
 * ends the electrical one, then the additional items in their format, then
 * the total, paid and remaining"). One page to print or save as a PDF; the
 * figures are the payment ledger's, the same as the Payments tab
 * (project/statement-rules.ts).
 *
 * Restyled to the approved sample-statement.html (owner, 21 Nov 2026): the
 * studio's header, Client and Summary boxes, the stage table, Total, Paid and
 * Remaining, and the signature. No "GST included" wording. Paid is what the
 * team recorded, as on the Payments tab (owner, 22 Nov 2026).
 */

const signed = (p: number) => `${p < 0 ? '−' : ''}${formatINR(Math.abs(p))}`;

/** Paid / Part paid / Not paid. */
const paidWord = (o: StatementOrder) => (o.amountPaise <= 0 ? '—' : o.paidPaise >= o.amountPaise ? 'Paid' : o.paidPaise > 0 ? 'Part paid' : 'Not paid');

function Orders({ title, orders, note }: { title: string; orders: StatementOrder[]; note?: string }) {
  if (orders.length === 0) return null;
  const sum = (k: 'amountPaise' | 'paidPaise' | 'remainingPaise') => orders.reduce((n, o) => n + o[k], 0);
  return (
    <section>
      <h2 className="mdoc-h2">{title}</h2>
      {note ? <p className="mdoc-notes">{note}</p> : null}
      {orders.map((o) => (
        <table key={o.id} className="mdoc-items mdoc-keep" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th colSpan={2}>
                {o.number} · {o.title} <span style={{ fontWeight: 400 }}>· {paidWord(o)}</span>
              </th>
              <th className="r" style={{ width: 110 }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {o.lines.map((x, i) => (
              <tr key={i}>
                <td style={{ width: 150 }}>{x.room || 'Whole home'}</td>
                <td>{x.product}</td>
                <td className="r">{formatINR(x.amountPaise)}</td>
              </tr>
            ))}
            <tr className="mdoc-grand">
              <td colSpan={2}>
                Total
                {o.paidPaise > 0 ? <span style={{ fontWeight: 400, fontSize: 13 }}> · paid {formatINR(o.paidPaise)}</span> : null}
              </td>
              <td className="r">{formatINR(o.amountPaise)}</td>
            </tr>
          </tbody>
        </table>
      ))}
      {orders.length > 1 ? (
        <p className="mdoc-notes" style={{ textAlign: 'right' }}>
          {title}: <b>{formatINR(sum('amountPaise'))}</b> · paid {formatINR(sum('paidPaise'))} · remaining {formatINR(sum('remainingPaise'))}
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
  const day = longDay(view.on);
  const stages = s.quotation.stages;
  const total = (k: 'signedPaise' | 'owedPaise' | 'paidPaise' | 'remainingPaise') => stages.reduce((n, st) => n + st[k], 0);
  const changed = stages.some((st) => st.owedPaise !== st.signedPaise);
  const q = view.quotes;
  const quotation = q.signed && q.designFinal && q.signed !== q.designFinal ? `${q.signed} (Design Final ${q.designFinal})` : q.designFinal ? `${q.designFinal} (Design Final)` : q.signed;

  return (
    <main className="mdoc-wrap px-4 py-6" style={{ background: '#ebe9ee' }}>
      <PrintStatement filename={filename} backHref={`/studio/projects/${id}?tab=payments`} />
      <div className="mdoc">
        <article className="mdoc-page" data-testid="statement">
          <DocHeader
            issuer={view.issuer}
            title="STATEMENT OF ACCOUNT"
            meta={[
              { label: 'As on', value: <b>{day}</b> },
              ...(quotation ? [{ label: 'Quotation', value: quotation }] : []),
              { label: 'Project value', value: formatINR(s.quotation.signedPaise) },
            ]}
          />

          <div className="mdoc-parties">
            <div className="mdoc-box">
              <h3>Client</h3>
              <b>{view.client}</b>
              <br />
              {view.home}
            </div>
            <div className="mdoc-box">
              <h3>Summary</h3>
              Paid: <b className="paid">{formatINR(s.totals.paidPaise)}</b>
              <br />
              Remaining: <b>{formatINR(s.totals.remainingPaise)}</b>
            </div>
          </div>

          <table className="mdoc-items">
            <thead>
              <tr>
                <th>Payment stage</th>
                <th className="r" style={{ width: 110 }}>
                  As signed
                </th>
                <th className="r" style={{ width: 110 }}>
                  Owed now
                </th>
                <th className="r" style={{ width: 100 }}>
                  Paid
                </th>
                <th className="r" style={{ width: 110 }}>
                  Remaining
                </th>
              </tr>
            </thead>
            <tbody>
              {stages.map((st, i) => (
                <tr key={i}>
                  <td>
                    <b>{st.label}</b>
                    {st.pct !== null ? (
                      <>
                        {' '}
                        · <span className="m">{st.pct}%</span>
                      </>
                    ) : null}
                  </td>
                  <td className="r">{formatINR(st.signedPaise)}</td>
                  <td className="r">{formatINR(st.owedPaise)}</td>
                  <td className={`r${st.paidPaise > 0 ? ' paid' : ''}`}>{formatINR(st.paidPaise)}</td>
                  <td className="r">{formatINR(st.remainingPaise)}</td>
                </tr>
              ))}
              <tr className="mdoc-grand">
                <td>Quotation total</td>
                <td className="r">{formatINR(s.quotation.signedPaise)}</td>
                <td className="r">{formatINR(total('owedPaise'))}</td>
                <td className="r">{formatINR(total('paidPaise'))}</td>
                <td className="r">{formatINR(total('remainingPaise'))}</td>
              </tr>
            </tbody>
          </table>
          <p className="mdoc-notes">&ldquo;Owed now&rdquo; includes extra work and changes, which land on the last stage.{changed ? '' : ' None on this project.'}</p>

          <Orders title="Electrical" orders={s.electrical} />
          <Orders title="Additional items" orders={s.additional} note="Extra work agreed after the design was signed off, paid in full before the work." />

          {s.otherChanges.length ? (
            <section>
              <h2 className="mdoc-h2">Other changes</h2>
              <table className="mdoc-items">
                <tbody>
                  {s.otherChanges.map((c, i) => (
                    <tr key={i}>
                      <td>{c.label}</td>
                      <td className="r">{signed(c.deltaPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <table className="mdoc-totals mdoc-keep">
            <tbody>
              <tr>
                <td>Total</td>
                <td className="r">
                  <b>{formatINR(s.totals.totalPaise)}</b>
                </td>
              </tr>
              <tr>
                <td>Paid</td>
                <td className="r paid">{formatINR(s.totals.paidPaise)}</td>
              </tr>
              <tr className="rem">
                <td>Remaining</td>
                <td className="r">{formatINR(s.totals.remainingPaise)}</td>
              </tr>
            </tbody>
          </table>

          {s.pending.length ? (
            <section className="mdoc-keep">
              <h2 className="mdoc-h2">Sent, not approved yet (not in the total)</h2>
              <ul className="mdoc-notes" style={{ paddingLeft: 18 }}>
                {s.pending.map((o) => (
                  <li key={o.id}>
                    {o.number} · {o.title}: {formatINR(o.amountPaise)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mdoc-notes">
            <PaymentNote issuer={view.issuer} />
            <p>This is a computer-generated statement from the project&rsquo;s Payments tab.</p>
          </div>

          <SignBlock issuer={view.issuer} />
          <DocFooter issuer={view.issuer} right={`Statement as on ${day}`} />
        </article>
      </div>
    </main>
  );
}
