import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../../StudioShell';
import { formatINR } from '@/lib/money';
import { payThese } from '@/modules/studio-crews/store';
import { STATUS_LABEL } from '@/modules/studio-crews/rules';
import { CrewsNav } from '../CrewsNav';
import { dayWords } from '../format';

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
      <PageBody>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">Paying crews is for the studio owner and accounts.</p>
      </PageBody>
    );
  }
  const fig = (label: string, value: string, note: string, alert = false) => (
    <div className="s-card flex flex-col gap-1 p-4">
      <span className="s-label">{label}</span>
      <span className="s-num font-[family-name:var(--font-mono)] text-[19px] font-semibold" style={alert ? { color: 'var(--s-warn)' } : undefined}>
        {value}
      </span>
      <span className="text-[12.5px] text-[var(--s-ink-3)]">{note}</span>
    </div>
  );
  return (
    <>
      <PageHead title="Pay these" sub="What each crew is owed on each job, largest first. Work done is the project manager's signal to pay." />
      <CrewsNav at="pay" />
      <PageBody>
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {fig('Outstanding to crews', formatINR(data.outstandingPaise), `${data.rows.length} open work order${data.rows.length === 1 ? '' : 's'}`)}
            {fig('Extra work', formatINR(data.extrasPaise), `beyond the quotation, on ${data.extrasOrders} work order${data.extrasOrders === 1 ? '' : 's'}`, data.extrasPaise > 100)}
            {fig('Still to price', String(data.needPrice + data.needQty), `${data.needQty} need a quantity, ${data.needPrice} need a price`)}
          </div>
          {data.rows.length === 0 ? (
            <p className="s-card m-0 p-5 text-[14px] text-[var(--s-ink-2)]">Nothing is owed to any crew right now.</p>
          ) : (
            <section className="s-card overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="text-left">
                    {['Crew', 'Project', 'Status', 'Pay by', 'Billed', 'Paid', 'Balance', ''].map((h, i) => (
                      <th key={i} className={`s-label px-4 py-2.5 font-normal ${['Billed', 'Paid', 'Balance'].includes(h) ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--s-rule)]">
                      <td className="px-4 py-3">
                        <Link href={`/studio/vendors/${r.vendorId}`} className="font-semibold text-[var(--s-ink)] no-underline hover:text-[var(--s-accent)]">
                          {r.crewName}
                        </Link>
                        <span className="block text-[12.5px] text-[var(--s-ink-3)]">{r.trades}</span>
                      </td>
                      <td className="px-4 py-3">
                        {r.projectName}
                        <span className="block text-[12.5px] text-[var(--s-ink-3)]">WO-{r.number}{r.pendingLines ? ` · +${r.pendingLines} to price` : ''}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: r.status === 'WORK_DONE' ? 'var(--s-warn)' : undefined }}>
                        {STATUS_LABEL[r.status]}
                      </td>
                      <td className="s-num px-4 py-3" style={{ color: r.overdue ? 'var(--s-bad)' : undefined }}>
                        {dayWords(r.dueOn)}
                        {r.overdue ? ' · overdue' : ''}
                      </td>
                      <td className="s-num px-4 py-3 text-right font-[family-name:var(--font-mono)]">{formatINR(r.billPaise)}</td>
                      <td className="s-num px-4 py-3 text-right font-[family-name:var(--font-mono)]">{formatINR(r.paidPaise)}</td>
                      <td className="s-num px-4 py-3 text-right font-[family-name:var(--font-mono)] font-semibold">{formatINR(r.balancePaise)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/studio/vendors/orders/${r.id}`} className="s-btn no-underline">
                          Pay
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      </PageBody>
    </>
  );
}
