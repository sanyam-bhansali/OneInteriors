import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../../StudioShell';
import { formatINR } from '@/lib/money';
import { crewPaymentsLedger } from '@/modules/studio-crews/store';
import { CrewsNav } from '../CrewsNav';
import { dayWords } from '../format';

export const metadata: Metadata = { title: 'Crew payments', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MODE: Record<string, string> = { UPI: 'UPI', BANK: 'Bank', CASH: 'Cash', CHEQUE: 'Cheque' };

/** Every rupee paid to a crew, newest first, recorded by name; corrections sit beside what they reverse. Owner and accounts. */
export default async function CrewPaymentsPage() {
  const data = await crewPaymentsLedger();
  if (!data) {
    return (
      <PageBody>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">Crew payments are for the studio owner and accounts.</p>
      </PageBody>
    );
  }
  return (
    <>
      <PageHead
        title={`${formatINR(data.totalPaise)} paid to crews`}
        sub={data.byMode.length ? data.byMode.map((m) => `${MODE[m.mode] ?? m.mode} ${formatINR(m.amountPaise)}`).join(' · ') : 'Nothing paid yet.'}
      />
      <CrewsNav at="payments" />
      <PageBody>
        {data.rows.length === 0 ? (
          <p className="s-card m-0 p-5 text-[14px] text-[var(--s-ink-2)]">No payments yet.</p>
        ) : (
          <div className="s-card overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
              <thead>
                <tr className="text-left">
                  {['Date', 'Crew', 'Project', 'What', 'Mode', 'By', 'Amount'].map((h) => (
                    <th key={h} className={`s-label px-3 py-2.5 font-normal ${h === 'Amount' ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--s-rule)]" style={r.kind === 'CORRECTION' ? { color: 'var(--s-ink-3)' } : undefined}>
                    <td className="s-num px-3 py-2.5">{dayWords(r.paidOn)}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/studio/vendors/${r.vendorId}`} className="text-[var(--s-ink)] no-underline hover:text-[var(--s-accent)]">
                        {r.crewName}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/studio/vendors/orders/${r.workOrderId}`} className="text-[var(--s-ink-2)] no-underline hover:text-[var(--s-accent)]">
                        {r.projectName}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.kind === 'ADVANCE' ? 'Advance' : r.kind === 'CORRECTION' ? 'Correction' : 'Payment'}
                      {r.note ? <span className="block text-[12px] text-[var(--s-ink-3)]">{r.note}</span> : null}
                    </td>
                    <td className="px-3 py-2.5">
                      {MODE[r.mode] ?? r.mode}
                      {r.reference ? <span className="block text-[12px] text-[var(--s-ink-3)]">{r.reference}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--s-ink-2)]">{r.byName}</td>
                    <td className="s-num px-3 py-2.5 text-right font-[family-name:var(--font-mono)]">{formatINR(r.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
    </>
  );
}
