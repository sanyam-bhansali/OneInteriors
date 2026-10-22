import Link from 'next/link';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { paymentsDesk } from '@/modules/project/payments-flow';
import { finalPayments } from '@/modules/project/closure';
import { extrasToCollect } from '@/modules/project/change-orders';
import { ExtrasToCollect } from '../projects/[id]/ExtrasToCollect';
import { PaymentsBody } from '../projects/[id]/PaymentsTab';
import { bookingDraft, bookingsToRecord, recentBookings } from '@/modules/studio-sales/booking';
import { currentMember } from '@/modules/studio/access';
import { Bookings } from './Bookings';
import { CrewToday } from '../vendors/CrewToday';
import '../office-ui.css';
import '../vendors/vendors.css';
import './payments.css';

export const metadata: Metadata = { title: 'Payments', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Where an accounts member lands (studio workspace Phase 5): every project's
 * money, computed from the payment rows — what is paid, what is waiting for
 * the customer's confirmation, what is owed — with "Mark a payment received"
 * on each, the same control as the project's Payments tab, so there is one
 * way to record money. Nothing else of the project is read for this screen
 * (studio/roles.ts: accounts sees payments across all projects, nothing
 * else). The projects needing attention come first: a payment the customer
 * says they did not make, then money waiting for their yes.
 */
export default async function PaymentsDeskPage() {
  const [projects, member, toBook, recent] = await Promise.all([paymentsDesk(), currentMember(), bookingsToRecord(), recentBookings()]);
  /* Studio OS Phase 1: the booking advance is recorded here too, on the
     sales final, with the same form as the lead page. */
  /* The project lifecycle — TO BE SPECIFIED (owner): the accounts flow for the closure's final payment. For now it shows here, first, and is recorded with the same payment recording. */
  const [finals, extras] = await Promise.all([finalPayments(projects.map((p) => p.id)), extrasToCollect(projects.map((p) => p.id))]);
  const drafts = Object.fromEntries(await Promise.all(toBook.map(async (w) => [w.quoteId, await bookingDraft(member, w.quoteId)] as const)));
  const weight = (p: (typeof projects)[number]) => {
    const rows = p.payments?.rows ?? [];
    if (finals.has(p.id) && (p.payments?.ledger.balancePaise ?? 0) > 0) return -1;
    if (rows.some((r) => r.status === 'disputed')) return 0;
    if (rows.some((r) => r.status === 'waiting')) return 1;
    return (p.payments?.ledger.balancePaise ?? 0) > 0 ? 2 : 3;
  };
  const sorted = [...projects].sort((a, b) => weight(a) - weight(b));
  const owed = projects.reduce((n, p) => n + Math.max(0, p.payments?.ledger.balancePaise ?? 0), 0);
  const waiting = projects.reduce((n, p) => n + (p.payments?.ledger.waitingPaise ?? 0), 0);
  const disputed = projects.filter((p) => weight(p) === 0).length;

  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>Payments</h1>
          <p className="muted" style={{ maxWidth: '72ch' }}>
            Every project&rsquo;s payment stages. Record money the day it arrives, with the receipt; the customer confirms it in the app, and it files in their locker.
          </p>
        </div>
      </div>

      {projects.length > 0 ? (
        <section className="card" aria-label="Money across projects">
          <div className="money">
            <div className="vd-due">
              <span className="sm">Still to come in</span>
              <b className="mono">{formatINR(owed)}</b>
              <span className="sm">
                across {projects.length} project{projects.length === 1 ? '' : 's'}
              </span>
            </div>
            <div>
              <span className="muted sm">Recorded, waiting for the customer to confirm</span>
              <b className="mono">{formatINR(waiting)}</b>
            </div>
            <div style={disputed ? { background: 'var(--bad-bg)' } : undefined}>
              <span className={disputed ? 'sm bad-t' : 'muted sm'}>Customer says not paid</span>
              <b className={disputed ? 'bad-t' : undefined}>{disputed ? `${disputed} project${disputed === 1 ? '' : 's'}` : 'None'}</b>
              {disputed ? <span className="sm bad-t">One Interiors is looking into it and will call you.</span> : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="cols">
        <div className="colmain">
          <Bookings waiting={toBook} drafts={drafts} recent={recent} isOwner={member?.role === 'OWNER'} />

          {projects.length === 0 ? (
            <div className="empty">
              <b>No projects yet</b>
              <span className="muted sm">A project appears here once a client signs with your studio.</span>
            </div>
          ) : (
            <ul className="pay-list">
              {sorted.map((p) => (
                <li key={p.id} className="card">
                  <div className="chead">
                    <div>
                      <h2>{p.label}</h2>
                      <span className="muted sm">{p.customer}</span>
                    </div>
                    {p.canOpen ? (
                      <Link href={`/studio/projects/${p.id}?tab=payments`} className="btn ghost sm">
                        Open the project
                      </Link>
                    ) : null}
                  </div>
                  {finals.has(p.id) ? (
                    <div className="banner" role="status" data-testid="final-payment" style={{ background: (p.payments?.ledger.balancePaise ?? 0) > 0 ? 'var(--warn-bg)' : 'var(--good-bg)', color: (p.payments?.ledger.balancePaise ?? 0) > 0 ? 'var(--warn)' : 'var(--good)', padding: '10px 14px', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <b>Final payment from closure: {formatINR(finals.get(p.id)!.finalDuePaise)}</b>
                      <span className="sm">
                        Closed out {finals.get(p.id)!.closedOn}.{' '}
                        {(p.payments?.ledger.balancePaise ?? 0) > 0 ? `${formatINR(p.payments!.ledger.balancePaise)} still to record, on the last stage below.` : 'Recorded in full.'}
                      </span>
                    </div>
                  ) : null}
                  {/* Change orders (15 Oct 2026): approved extra work to collect. */}
                  {extras.get(p.id)?.length ? <ExtrasToCollect items={extras.get(p.id)!} canRecord={p.payments?.canRecord ?? false} /> : null}
                  {p.payments ? (
                    <PaymentsBody data={p.payments} customer={p.customer.split(/\s+/)[0] ?? p.customer} />
                  ) : (
                    <p className="muted sm" style={{ margin: 0 }}>
                      No payment stages were signed in the app for this project.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="colside">
          {/* Studio OS Phase 3: crews whose work is done or due, with what is owed. */}
          <CrewToday />
          <div className="empty">
            <b>One way to record money</b>
            <span className="muted sm">The same control as each project&rsquo;s Payments tab. A customer&rsquo;s &ldquo;not paid&rdquo; comes first on this list.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
