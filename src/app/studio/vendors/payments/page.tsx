import Link from 'next/link';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { crewPaymentsLedger } from '@/modules/studio-crews/store';
import { dayWords } from '../format';
import '../../office-ui.css';
import '../vendors.css';

export const metadata: Metadata = { title: 'Crew payments', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MODE: Record<string, string> = { UPI: 'UPI', BANK: 'Bank', CASH: 'Cash', CHEQUE: 'Cheque' };

/** Every rupee paid to a crew, newest first, recorded by name; corrections sit beside what they reverse. Owner and accounts. */
export default async function CrewPaymentsPage() {
  const data = await crewPaymentsLedger();
  if (!data) {
    return (
      <main className="content ox-page">
        <p className="ox-note">Crew payments are for the studio owner and accounts.</p>
      </main>
    );
  }
  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <span className="eyebrow">Paid to crews</span>
          <h1 className="mono">{formatINR(data.totalPaise)}</h1>
          <p className="muted">{data.byMode.length ? data.byMode.map((m) => `${MODE[m.mode] ?? m.mode} ${formatINR(m.amountPaise)}`).join(' · ') : 'Nothing paid yet.'}</p>
        </div>
      </div>
      {data.rows.length === 0 ? (
        <div className="empty">
          <b>No payments yet.</b>
        </div>
      ) : (
        <section className="card flush" aria-labelledby="h-ledger">
          <div className="chead">
            <h2 id="h-ledger">Every payment</h2>
            <span className="muted sm">Newest first. Corrections stay beside what they reverse.</span>
          </div>
          <div className="tscroll">
            <table className="tbl" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  {['Date', 'Crew', 'Project', 'What', 'Mode', 'By'].map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className={r.kind === 'CORRECTION' ? 'muted' : undefined}>
                    <td className="mono">{dayWords(r.paidOn)}</td>
                    <td>
                      <Link href={`/studio/vendors/${r.vendorId}`} style={{ fontWeight: 600 }}>
                        {r.crewName}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/studio/vendors/orders/${r.workOrderId}`}>{r.projectName}</Link>
                    </td>
                    <td>
                      {r.kind === 'ADVANCE' ? 'Advance' : r.kind === 'CORRECTION' ? 'Correction' : 'Payment'}
                      {r.note ? <div className="muted sm">{r.note}</div> : null}
                    </td>
                    <td>
                      {MODE[r.mode] ?? r.mode}
                      {r.reference ? <div className="muted sm mono">{r.reference}</div> : null}
                    </td>
                    <td className="muted">{r.byName}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {formatINR(r.amountPaise)}
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
