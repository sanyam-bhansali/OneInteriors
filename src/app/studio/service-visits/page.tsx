import Link from 'next/link';
import type { Metadata } from 'next';
import { studioServiceVisits } from '@/modules/aftercare/store';
import { VisitActions } from './VisitActions';

export const metadata: Metadata = {
  title: 'Service visits',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

/**
 * Service visits clients booked after the handover (owner, 20 Nov 2026;
 * docs/studio-os/AFTERCARE.md), soonest first, with the last 14 days' booked
 * visits still to mark done. A visit is booked once its charge is paid (or
 * it is the client's free visit); "waiting for payment" is a slot held for
 * 20 minutes while the client pays. Owner, PM and the design head move,
 * cancel (a paid visit is refunded in full) and mark visits done; accounts
 * reads. The visiting charges are in Settings.
 */
export default async function ServiceVisitsPage() {
  const data = await studioServiceVisits();
  if (data === null) {
    return (
      <main className="content ox-page">
        <p className="muted">Service visits are for the office and the design head.</p>
      </main>
    );
  }
  const { visits, canAct, moveDays, starts } = data;
  return (
    <main className="content ox-page">
      <section className="flex max-w-[52rem] flex-col gap-4">
        <div className="phead">
          <div>
            <h1>Service visits</h1>
            <p className="muted" style={{ maxWidth: '72ch' }}>
              Booked by clients after the handover. The visiting charges are under{' '}
              <Link href="/studio/settings" className="underline">
                Settings
              </Link>
              .
            </p>
          </div>
        </div>
        {visits.length === 0 ? (
          <p className="muted">No visits coming up.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {visits.map((v) => (
              <li key={v.id} className="card flex flex-col gap-2 p-4" data-testid="service-visit">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <b>
                    {v.category} · {v.client}
                  </b>
                  <span className="mono sm">{v.when}</span>
                </div>
                <p className="m-0 text-[14px]">{v.description}</p>
                <p className="m-0 muted sm">
                  {v.charge} · {v.state === 'booked' ? (v.paid ? 'Paid, booked' : 'Booked') : 'Waiting for payment'} ·{' '}
                  <Link href={`/studio/projects/${v.projectId}`} className="underline">
                    Project
                  </Link>
                </p>
                {canAct && v.state === 'booked' ? (
                  <VisitActions id={v.id} day={v.day} start={v.start} paid={v.paid} charge={v.charge} moveDays={moveDays} starts={starts} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
