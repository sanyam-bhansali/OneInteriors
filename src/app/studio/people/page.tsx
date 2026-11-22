import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { staffList } from '@/modules/staff/store';
import '../office-ui.css';

export const metadata: Metadata = { title: 'People', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

/** Employee records (owner, 21 Nov 2026): everyone on the team, with what is missing. Owner and accounts only. */
export default async function PeoplePage() {
  const rows = await staffList();
  if (!rows) notFound();
  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>People</h1>
          <p className="muted" style={{ maxWidth: '72ch' }}>
            Each person&rsquo;s documents (Aadhaar, PAN, offer letter, address proof, photo), salary, incentives and devices. Only the owner and accounts see this.
          </p>
        </div>
      </div>
      <section className="card">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="muted text-left">
              <th>Name</th>
              <th>Role</th>
              <th>Salary / month</th>
              <th>Documents</th>
              <th>Devices</th>
              <th>Incentives owed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.memberId} style={r.active ? undefined : { opacity: 0.55 }}>
                <td>
                  <Link href={`/studio/people/${r.memberId}`} className="underline">
                    {r.name}
                  </Link>
                  {r.active ? null : <span className="muted"> · not active</span>}
                </td>
                <td>{r.designation || r.role}</td>
                <td className="mono">{r.salaryPaise ? inr(r.salaryPaise) : '—'}</td>
                <td style={{ color: r.missingDocs.length ? 'var(--bad)' : 'var(--good)' }}>{r.missingDocs.length ? `${r.missingDocs.length} missing` : 'All on file'}</td>
                <td>{r.devicesOut || '—'}</td>
                <td className="mono">{r.incentivesOwedPaise ? inr(r.incentivesOwedPaise) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
