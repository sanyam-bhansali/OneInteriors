import Link from 'next/link';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { payThese } from '@/modules/studio-crews/store';
import { STATUS_LABEL } from '@/modules/studio-crews/rules';
import { dayWords } from '../format';
import '../../office-ui.css';
import '../vendors.css';

export const metadata: Metadata = { title: 'Pay these', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Pay these (Studio OS Phase 3 §5): every live work order with more than ₹1
 * outstanding, largest balance first, with its due date and whether the PM
 * has marked the work done (the signal to pay). Owner and accounts.
 */
export default async function PayThesePage() {
  const data = await payThese();
  if (!data) {
    return (
      <main className="content ox-page">
        <p className="ox-note">Paying crews is for the studio owner and accounts.</p>
      </main>
    );
  }
  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>Pay crews</h1>
          <p className="muted">What each crew is owed on each job, largest first. Work done is the project manager&apos;s signal to pay.</p>
        </div>
      </div>
      <section className="card" aria-label="Totals">
        <div className="money">
          <div className="vd-due">
            <span className="sm">Outstanding to crews</span>
            <b className="mono">{formatINR(data.outstandingPaise)}</b>
            <span className="sm">
              {data.rows.length} open work order{data.rows.length === 1 ? '' : 's'}
            </span>
          </div>
          <div>
            <span className="muted sm">Extra work</span>
            <b className={`mono${data.extrasPaise > 100 ? ' warn-t' : ''}`}>{formatINR(data.extrasPaise)}</b>
            <span className="muted sm">
              beyond the quotation, on {data.extrasOrders} work order{data.extrasOrders === 1 ? '' : 's'}
            </span>
          </div>
          <div>
            <span className="muted sm">Still to price</span>
            <b className="mono">{data.needPrice + data.needQty}</b>
            <span className="muted sm">
              {data.needQty} need a quantity, {data.needPrice} need a price
            </span>
          </div>
        </div>
      </section>
      {data.rows.length === 0 ? (
        <div className="empty">
          <b>Nothing is owed to any crew right now.</b>
        </div>
      ) : (
        <section className="card flush" aria-labelledby="h-pay">
          <div className="chead">
            <h2 id="h-pay">Work orders to pay</h2>
            <span className="muted sm">Recorded here, paid by you as usual</span>
          </div>
          <div className="tscroll">
            <table className="tbl" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th scope="col">Crew</th>
                  <th scope="col">Project</th>
                  <th scope="col">Status</th>
                  <th scope="col">Pay by</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Billed
                  </th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Paid
                  </th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Balance
                  </th>
                  <th scope="col">
                    <span className="sr-only">Pay</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/studio/vendors/${r.vendorId}`} style={{ fontWeight: 600 }}>
                        {r.crewName}
                      </Link>
                      <div className="muted sm">{r.trades}</div>
                    </td>
                    <td>
                      {r.projectName}
                      <div className="muted sm mono">
                        WO-{r.number}
                        {r.pendingLines ? ` · +${r.pendingLines} to price` : ''}
                      </div>
                    </td>
                    <td>
                      {r.status === 'WORK_DONE' ? (
                        <span className="chip warn">
                          <span className="dot" />
                          {STATUS_LABEL[r.status]}
                        </span>
                      ) : (
                        <span className="chip">{STATUS_LABEL[r.status]}</span>
                      )}
                    </td>
                    <td className={`mono${r.overdue ? ' bad-t' : ''}`}>
                      {dayWords(r.dueOn)}
                      {r.overdue ? ' · overdue' : ''}
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {formatINR(r.billPaise)}
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {formatINR(r.paidPaise)}
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatINR(r.balancePaise)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/studio/vendors/orders/${r.id}`} className="btn pri sm">
                        Pay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
