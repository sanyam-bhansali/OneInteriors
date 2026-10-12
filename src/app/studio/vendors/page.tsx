import Link from 'next/link';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { crewsList } from '@/modules/studio-crews/store';
import { myWorkOrders } from '@/modules/studio-practice/vendors';
import { AddCrew } from './CrewForms';
import { LineIcon } from '../ui/icons';
import '../office-ui.css';
import './vendors.css';

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
 * The look is the owner's handoff (Vendors, 12 Oct 2026): the crews down the
 * side with what each is still owed, the studio's totals, and the crews
 * table. A crew opens on its own page (rate card, KYC, work orders, pay).
 *
 * The older vendor work orders (on the pre-2026 internal projects) are shown
 * read-only at the foot, for the record.
 */
export default async function CrewsPage() {
  const [data, legacy] = await Promise.all([crewsList(), myWorkOrders()]);
  if (!data) {
    return (
      <main className="content ox-page">
        <p className="ox-note">Crews are kept by the studio owner and accounts.</p>
      </main>
    );
  }
  const live = data.crews.filter((c) => !c.archived);
  const archived = data.crews.filter((c) => c.archived);
  const owed = live.reduce((s, c) => s + Math.max(0, c.balancePaise), 0);
  const billed = live.reduce((s, c) => s + c.billPaise, 0);
  const gaps = live.filter((c) => c.kyc.tone === 'alert').length;
  const tradesUsed = new Set(live.flatMap((c) => c.trades.map((t) => t.key))).size;
  const openOrders = live.reduce((s, c) => s + c.openOrders, 0);

  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>Vendors</h1>
          <p className="muted">
            Your site crews, carpenters to painters: what you ordered, what you paid, what&apos;s left.{' '}
            {`${live.length} crew${live.length === 1 ? '' : 's'} · ${tradesUsed} trade${tradesUsed === 1 ? '' : 's'}${gaps ? ` · ${gaps} with KYC missing` : ''}`}
          </p>
        </div>
        <div className="hstack">
          <Link href="/studio/vendors/pay" className="btn sec">
            Pay crews
          </Link>
          <AddCrew trades={data.settings.trades} />
        </div>
      </div>

      {live.length === 0 ? (
        <div className="empty">
          <b>Your site crews, and what each is owed.</b>
          <span className="muted sm" style={{ maxWidth: '64ch' }}>
            Add a carpenter, a painter, an electrician. Each keeps their own rate card: two carpenters can price the same work differently. On a booked project, the Crews tab
            turns the final quotation into work orders and prices most lines from the crew&apos;s card by itself.
          </span>
        </div>
      ) : (
        <div className="cols">
          <nav className="vlist vd-side" aria-label="Crews">
            {live.map((c) => (
              <Link key={c.id} href={`/studio/vendors/${c.id}`} className="vrow" aria-current="false">
                <b style={{ fontWeight: 600 }}>{c.name}</b>
                <span className="mono sm" style={{ textAlign: 'right' }}>
                  {formatINR(Math.max(0, c.balancePaise))}
                </span>
                <span className="muted sm">{c.trades.map((t) => t.label).join(', ') || 'No trade yet'}</span>
                <span className="muted sm" style={{ textAlign: 'right' }}>
                  due
                </span>
              </Link>
            ))}
          </nav>

          <div className="colmain">
            <section className="card" aria-labelledby="h-totals">
              <div className="chead">
                <div>
                  <h2 id="h-totals">Across your crews</h2>
                  <span className="muted sm">
                    {openOrders} open work order{openOrders === 1 ? '' : 's'} on live projects
                  </span>
                </div>
                <Link href="/studio/vendors/price" className="btn ghost sm">
                  Price these
                </Link>
              </div>
              <div className="money">
                <div>
                  <span className="muted sm">Billed</span>
                  <b className="mono">{formatINR(billed)}</b>
                </div>
                <div>
                  <span className="muted sm">Paid</span>
                  <b className="mono">{formatINR(Math.max(0, billed - live.reduce((s, c) => s + c.balancePaise, 0)))}</b>
                </div>
                <div className="vd-due">
                  <span className="sm">Still due</span>
                  <b className="mono">{formatINR(owed)}</b>
                </div>
              </div>
            </section>

            <section className="card flush" aria-labelledby="h-crews">
              <div className="chead">
                <h2 id="h-crews">Crews</h2>
                <span className="team">
                  <LineIcon name="lock" size={14} />
                  Only your team sees crew rates
                </span>
              </div>
              <div className="tscroll">
                <table className="tbl" style={{ minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th scope="col">Crew</th>
                      <th scope="col">Trades</th>
                      <th scope="col">Rate items</th>
                      <th scope="col">Work orders</th>
                      <th scope="col" style={{ textAlign: 'right' }}>
                        Billed
                      </th>
                      <th scope="col" style={{ textAlign: 'right' }}>
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {live.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/studio/vendors/${c.id}`} style={{ fontWeight: 600 }}>
                            {c.name}
                          </Link>
                          <div className="muted sm mono">{[c.workingSince ? `since ${c.workingSince}` : null, c.phone].filter(Boolean).join(' · ')}</div>
                          <div className={`vd-kyc ${c.kyc.tone === 'alert' ? 'bad-t' : c.kyc.tone === 'good' ? 'good-t' : 'muted'}`}>{c.kyc.label}</div>
                        </td>
                        <td>{c.trades.map((t) => t.label).join(', ')}</td>
                        <td className="mono">{c.rateItems}</td>
                        <td className="mono">
                          {c.orders}
                          {c.openOrders ? <span className="muted sm"> · {c.openOrders} open</span> : null}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {formatINR(c.billPaise)}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatINR(c.balancePaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {archived.length ? (
        <details className="vd-more">
          <summary>Archived ({archived.length})</summary>
          <ul>
            {archived.map((c) => (
              <li key={c.id}>
                <Link href={`/studio/vendors/${c.id}`}>{c.name}</Link> <span className="muted sm">· {formatINR(c.balancePaise)} balance</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {legacy.length ? (
        <details className="vd-more">
          <summary>Older vendor work orders, read only ({legacy.length})</summary>
          <ul>
            {legacy.map((o) => (
              <li key={o.id} className="muted">
                {o.vendorName} · {o.projectName} · {o.trade} · billed {formatINR(o.billPaise)}, paid {formatINR(o.paidPaise)}, balance {formatINR(o.balancePaise)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </main>
  );
}
