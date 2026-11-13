import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatINR } from '@/lib/money';
import { moneyDueList } from '@/modules/project/statement';
import '../../office-ui.css';

export const metadata: Metadata = { title: 'Money due', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Money due (owner, 13 Nov 2026: "analytics here: who owes how much"): every
 * running project with its total, paid and remaining, the most owed first.
 * For the owner, accounts and the design head. The figures are the payment
 * ledger's, the same as each project's Payments tab
 * (project/statement-rules.ts `moneyDue`).
 */
export default async function MoneyDuePage() {
  const view = await moneyDueList();
  if (!view) notFound();
  const t = view.totals;
  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>Money due</h1>
          <p className="muted" style={{ maxWidth: '72ch' }}>
            Who owes how much, the most first. Paid counts what the client confirmed (and what was recorded before confirmations started). Remaining is the total less paid.
          </p>
        </div>
        <div className="hstack">
          <Link href="/studio/payments" className="btn ghost">
            Payments
          </Link>
        </div>
      </div>

      {view.rows.length === 0 ? (
        <div className="empty">
          <b>Nothing due</b>
          <span className="muted sm">A project shows here once it has a signed payment plan.</span>
        </div>
      ) : (
        <div className="card p-0 tscroll">
          <table className="tbl" aria-label="Money due by project" data-testid="money-due">
            <thead>
              <tr>
                <th>Project</th>
                <th className="text-right">Total</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Waiting to confirm</th>
                <th className="text-right">Remaining</th>
                <th>Ask for next</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {view.canOpen ? (
                      <Link href={`/studio/projects/${r.id}?tab=payments`} className="acc-t font-semibold">
                        {r.customer}
                      </Link>
                    ) : (
                      <b>{r.customer}</b>
                    )}
                    <span className="muted sm"> · {r.label}</span>
                    {' '}
                    <Link href={`/studio/projects/${r.id}/statement`} className="sm acc-t">
                      Statement
                    </Link>
                  </td>
                  <td className="mono text-right">{formatINR(r.totalPaise)}</td>
                  <td className="mono text-right">{formatINR(r.paidPaise)}</td>
                  <td className="mono text-right">{r.waitingPaise ? formatINR(r.waitingPaise) : '—'}</td>
                  <td className="mono text-right font-semibold">{formatINR(r.remainingPaise)}</td>
                  <td className="sm">{r.nextStage ?? (r.remainingPaise > 0 ? 'Waiting for confirmation' : 'Paid in full')}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <b>{view.rows.length === 1 ? '1 project' : `${view.rows.length} projects`}</b>
                </td>
                <td className="mono text-right font-semibold">{formatINR(t.totalPaise)}</td>
                <td className="mono text-right font-semibold">{formatINR(t.paidPaise)}</td>
                <td className="mono text-right font-semibold">{t.waitingPaise ? formatINR(t.waitingPaise) : '—'}</td>
                <td className="mono text-right font-semibold">{formatINR(t.remainingPaise)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
