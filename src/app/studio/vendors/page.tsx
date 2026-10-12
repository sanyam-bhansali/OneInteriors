import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../StudioShell';
import { formatINR } from '@/lib/money';
import { crewsList } from '@/modules/studio-crews/store';
import { myWorkOrders } from '@/modules/studio-practice/vendors';
import { AddCrew } from './CrewForms';
import { CrewsNav } from './CrewsNav';

export const metadata: Metadata = { title: 'Crews', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Crews (Studio OS Phase 3, docs/studio-os/PHASE-3-EXECUTION.md §1): the site
 * crews the studio works with — carpenters, false ceiling, painters,
 * electricians, glass, upholstery, fabrication, civil — each with their own
 * rate card, and what each is owed across live projects. Owner and accounts.
 *
 * Bill, paid and balance are added up from the work-order lines and the
 * payments on every render; nothing is stored as a total.
 *
 * The older vendor work orders (on the pre-2026 internal projects) are shown
 * read-only at the foot, for the record.
 */
export default async function CrewsPage() {
  const [data, legacy] = await Promise.all([crewsList(), myWorkOrders()]);
  if (!data) {
    return (
      <PageBody>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">Crews are kept by the studio owner and accounts.</p>
      </PageBody>
    );
  }
  const live = data.crews.filter((c) => !c.archived);
  const archived = data.crews.filter((c) => c.archived);
  const owed = live.reduce((s, c) => s + Math.max(0, c.balancePaise), 0);
  const gaps = live.filter((c) => c.kyc.tone === 'alert').length;
  const tradesUsed = new Set(live.flatMap((c) => c.trades.map((t) => t.key))).size;

  return (
    <>
      <PageHead
        title="Crews"
        sub={`${live.length} crew${live.length === 1 ? '' : 's'} · ${tradesUsed} trade${tradesUsed === 1 ? '' : 's'}${gaps ? ` · ${gaps} with KYC missing` : ''}${owed ? ` · ${formatINR(owed)} owed` : ''}`}
        action={<AddCrew trades={data.settings.trades} />}
      />
      <CrewsNav at="crews" />
      <PageBody>
        <div className="flex flex-col gap-6">
          {live.length === 0 ? (
            <div className="s-card p-6">
              <p className="m-0 mb-2 text-[15.5px] font-semibold">Your site crews, and what each is owed.</p>
              <p className="m-0 max-w-[64ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
                Add a carpenter, a painter, an electrician. Each keeps their own rate card: two carpenters can price the same work differently. On a booked project, the
                Crews tab turns the final quotation into work orders and prices most lines from the crew&apos;s card by itself.
              </p>
            </div>
          ) : (
            <section className="s-card overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="text-left">
                    {['Crew', 'Trades', 'Rate items', 'Work orders', 'Billed', 'Balance'].map((h) => (
                      <th key={h} className={`s-label px-4 py-2.5 font-normal ${h === 'Billed' || h === 'Balance' ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {live.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--s-rule)]">
                      <td className="px-4 py-3">
                        <Link href={`/studio/vendors/${c.id}`} className="font-semibold text-[var(--s-ink)] no-underline hover:text-[var(--s-accent)]">
                          {c.name}
                        </Link>
                        <span className="block text-[12.5px] text-[var(--s-ink-3)]">
                          {[c.workingSince ? `since ${c.workingSince}` : null, c.phone].filter(Boolean).join(' · ')}
                        </span>
                        <span className="text-[12px]" style={{ color: c.kyc.tone === 'alert' ? 'var(--s-bad)' : c.kyc.tone === 'good' ? 'var(--s-good)' : 'var(--s-ink-3)' }}>
                          {c.kyc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">{c.trades.map((t) => t.label).join(', ')}</td>
                      <td className="s-num px-4 py-3">{c.rateItems}</td>
                      <td className="s-num px-4 py-3">
                        {c.orders}
                        {c.openOrders ? <span className="text-[12.5px] text-[var(--s-ink-3)]"> · {c.openOrders} open</span> : null}
                      </td>
                      <td className="s-num px-4 py-3 text-right font-[family-name:var(--font-mono)]">{formatINR(c.billPaise)}</td>
                      <td className="s-num px-4 py-3 text-right font-[family-name:var(--font-mono)] font-semibold">{formatINR(c.balancePaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {archived.length ? (
            <details>
              <summary className="cursor-pointer text-[13.5px] font-medium text-[var(--s-ink-2)]">Archived ({archived.length})</summary>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                {archived.map((c) => (
                  <li key={c.id}>
                    <Link href={`/studio/vendors/${c.id}`} className="text-[13.5px] text-[var(--s-ink-2)]">
                      {c.name}
                    </Link>{' '}
                    <span className="text-[12.5px] text-[var(--s-ink-3)]">· {formatINR(c.balancePaise)} balance</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {legacy.length ? (
            <details>
              <summary className="cursor-pointer text-[13.5px] font-medium text-[var(--s-ink-2)]">Older vendor work orders, read only ({legacy.length})</summary>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                {legacy.map((o) => (
                  <li key={o.id} className="text-[13px] text-[var(--s-ink-2)]">
                    {o.vendorName} · {o.projectName} · {o.trade} · billed {formatINR(o.billPaise)}, paid {formatINR(o.paidPaise)}, balance {formatINR(o.balancePaise)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </PageBody>
    </>
  );
}
