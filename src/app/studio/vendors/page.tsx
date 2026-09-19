import { isLive } from '@/modules/studio/features';
import { ComingSoon } from '../ComingSoon';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../StudioShell';
import { formatINR } from '@/lib/money';
import { myVendors, myWorkOrders } from '@/modules/studio-practice/vendors';
import { myProjects } from '@/modules/studio-practice/projects';
import { AddVendor, NewWorkOrder, WorkOrderCard, VendorList } from './VendorPanels';

export const metadata: Metadata = {
  title: 'Vendors',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * What the studio owes its trades.
 *
 * ## The one question this page answers
 *
 * *Who do I pay, and how much.* Everything is grouped by vendor rather than by
 * project, because a vendor is who rings — a carpenter working across three of
 * your sites wants one number, not three.
 *
 * ## Nothing here is stored as a total
 *
 * Bill, paid and balance are computed from the lines and the payments on every
 * render. A stored total and a payments table disagree eventually, and in a
 * ledger the disagreement is always found by somebody who has been paid twice.
 * See the note at the top of `ledger.ts`.
 */
export default async function VendorsPage() {
  /* Not in the pilot. The rail already stops linking here; this stops a
     bookmark or a typed URL reaching a screen we are not standing behind
     yet. Flip the flag in modules/studio/features.ts to ship it. */
  if (!isLive('vendors')) return <ComingSoon feature="vendors" />;

  const [vendors, orders, projects] = await Promise.all([
    myVendors(),
    myWorkOrders(),
    myProjects(),
  ]);

  const owed = vendors.reduce((sum, v) => sum + Math.max(0, v.balancePaise), 0);
  const open = orders.filter((o) => !o.settled);
  const settled = orders.filter((o) => o.settled);
  const live = projects.filter((p) => p.stage !== 'CLOSED');

  return (
    <>
      <PageHead
        title={owed > 0 ? `${formatINR(owed)} owed` : 'Vendors'}
        sub={
          vendors.length === 0
            ? 'Nobody added yet.'
            : `${vendors.length} vendor${vendors.length === 1 ? '' : 's'} · ${open.length} open work order${open.length === 1 ? '' : 's'}`
        }
        action={<AddVendor />}
      />

      <PageBody>
        {vendors.length === 0 ? (
          <div className="s-card p-8">
            <p className="m-0 mb-2 text-[15.5px] font-semibold">
              Your trades, and what they are owed.
            </p>
            <p className="m-0 max-w-[64ch] text-[14.5px] leading-relaxed text-[var(--s-ink-2)]">
              Add a carpenter, a painter, an electrician. Raise a work order against a live
              project, put the agreed work on it, and record payments as they go out. The balance
              is worked out from the lines and the payments every time — nothing is stored as a
              total, so it cannot drift.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            <section>
              <h2 className="m-0 mb-3 text-[15px] font-semibold">Who is owed</h2>
              <VendorList vendors={vendors} />
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="m-0 text-[15px] font-semibold">
                  Open work orders {open.length > 0 ? `(${open.length})` : ''}
                </h2>
                <NewWorkOrder
                  projects={live.map((p) => ({ id: p.id, name: p.name }))}
                  vendors={vendors.map((v) => ({ id: v.id, name: v.name, trade: v.trade }))}
                />
              </div>

              {live.length === 0 ? (
                <p className="s-card m-0 px-4 py-3 text-[13.5px] leading-relaxed text-[var(--s-ink-2)]">
                  A work order is raised against a project, and there are none running.{' '}
                  <Link href="/studio/projects" className="text-[var(--s-accent)]">
                    Start a project
                  </Link>{' '}
                  first — a vendor bill with no site attached is a number nobody can reconcile
                  later.
                </p>
              ) : open.length === 0 ? (
                <p className="s-card m-0 px-4 py-3 text-[13.5px] italic text-[var(--s-ink-3)]">
                  Nothing outstanding.
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {open.map((o) => (
                    <WorkOrderCard key={o.id} order={o} />
                  ))}
                </ul>
              )}
            </section>

            {settled.length > 0 ? (
              <details>
                <summary className="mb-3 cursor-pointer select-none text-[13.5px] font-medium text-[var(--s-ink-2)]">
                  Settled ({settled.length})
                </summary>
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {settled.map((o) => (
                    <WorkOrderCard key={o.id} order={o} />
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        )}
      </PageBody>
    </>
  );
}
