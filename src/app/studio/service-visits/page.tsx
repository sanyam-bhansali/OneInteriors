import Link from 'next/link';
import type { Metadata } from 'next';
import { studioServiceVisits } from '@/modules/aftercare/store';

export const metadata: Metadata = {
  title: 'Service visits',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

/**
 * Paid service visits clients booked after the handover (owner, 20 Nov 2026;
 * docs/studio-os/AFTERCARE.md), soonest first: the office, accounts and the
 * design head. A visit is booked only once its charge is paid; one still
 * "waiting for payment" is a slot held for 20 minutes while the client pays.
 * The visiting charges are in Settings.
 */
export default async function ServiceVisitsPage() {
  const visits = await studioServiceVisits();
  if (visits === null) {
    return <p className="muted">Service visits are for the office and the design head.</p>;
  }
  return (
    <section className="flex max-w-[52rem] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[22px]">Service visits</h1>
        <p className="m-0 muted text-[14px]">
          Booked and paid by clients after the handover. The visiting charges are under{' '}
          <Link href="/studio/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      </div>
      {visits.length === 0 ? (
        <p className="muted">No visits coming up.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {visits.map((v) => (
            <li key={v.id} className="card flex flex-col gap-1 p-4" data-testid="service-visit">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <b>
                  {v.category} · {v.client}
                </b>
                <span className="mono sm">{v.when}</span>
              </div>
              <p className="m-0 text-[14px]">{v.description}</p>
              <p className="m-0 muted sm">
                {v.charge} · {v.state === 'booked' ? 'Booked' : 'Waiting for payment'} ·{' '}
                <Link href={`/studio/projects/${v.projectId}`} className="underline">
                  Project
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
