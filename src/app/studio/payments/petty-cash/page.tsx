import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pettyDesk } from '@/modules/petty-cash/store';
import { ExpenseList, GiveCash } from './PettyUi';
import '../../office-ui.css';

export const metadata: Metadata = { title: 'Petty cash', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

/**
 * Accounts' petty cash (owner, 21 Nov 2026): enter what was given to whom,
 * see what is still with each person, and review the flagged expenses (each
 * flag says why) — clear them or reject the expense.
 */
export default async function PettyCashPage() {
  const desk = await pettyDesk();
  if (!desk) notFound();
  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>Petty cash</h1>
          <p className="muted" style={{ maxWidth: '72ch' }}>
            What each person was given, what they spent and on which project, and what is still with them. Flagged expenses come first, each with the reason.
          </p>
        </div>
        <Link href="/studio/payments" className="btn sec">
          Payments
        </Link>
      </div>

      <GiveCash team={desk.team} today={desk.today} />

      <section className="card" aria-label="With each person">
        <h2 className="m-0 text-[15px] font-semibold">With each person</h2>
        {desk.people.length === 0 ? (
          <p className="muted m-0">No petty cash given yet.</p>
        ) : (
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="muted text-left">
                <th>Person</th>
                <th>Given</th>
                <th>Spent</th>
                <th>With them</th>
                <th>Not marked received</th>
              </tr>
            </thead>
            <tbody>
              {desk.people.map((p) => (
                <tr key={p.memberId}>
                  <td>{p.name}</td>
                  <td className="mono">{inr(p.given)}</td>
                  <td className="mono">{inr(p.spent)}</td>
                  <td className="mono" style={{ color: p.pending < 0 ? 'var(--bad)' : undefined }}>
                    {inr(p.pending)}
                    {p.pending < 0 ? ' (spent more than given)' : ''}
                  </td>
                  <td className="mono">{p.waitingToMark ? inr(p.waitingToMark) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" aria-label="Flags to review" style={desk.flagged.length ? { background: 'var(--warn-soft)' } : undefined}>
        <h2 className="m-0 text-[15px] font-semibold">Flags to review{desk.flagged.length ? ` · ${desk.flagged.length}` : ''}</h2>
        {desk.flagged.length === 0 ? <p className="muted m-0">Nothing flagged.</p> : <ExpenseList rows={desk.flagged} review />}
      </section>

      <section className="card" aria-label="Recent expenses">
        <h2 className="m-0 text-[15px] font-semibold">Recent expenses</h2>
        {desk.recent.length === 0 ? <p className="muted m-0">No expenses yet.</p> : <ExpenseList rows={desk.recent} review />}
      </section>
    </main>
  );
}
