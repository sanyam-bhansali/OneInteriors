import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { staffRecord } from '@/modules/staff/store';
import { DevicesBox, DocsBox, IncentivesBox, ProfileBox, SalaryBox } from './StaffUi';
import '../../office-ui.css';

export const metadata: Metadata = { title: 'Employee record', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** One employee's record (owner, 21 Nov 2026): documents, salary, incentives and payouts, devices. Owner and accounts only. */
export default async function StaffRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await staffRecord(id);
  if (!r) notFound();
  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>{r.name}</h1>
          <p className="muted">
            {r.role}
            {r.phone ? ` · ${r.phone}` : ''}
            {r.email ? ` · ${r.email}` : ''}
            {r.active ? '' : ' · not active'}
          </p>
        </div>
        <Link href="/studio/people" className="btn sec">
          People
        </Link>
      </div>
      <ProfileBox r={r} />
      <DocsBox r={r} />
      <SalaryBox r={r} />
      <IncentivesBox r={r} />
      <DevicesBox r={r} />
    </main>
  );
}
