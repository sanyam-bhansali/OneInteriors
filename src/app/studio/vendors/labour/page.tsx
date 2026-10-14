import Link from 'next/link';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { labourOverview } from '@/modules/studio-crews/store';
import '../../office-ui.css';
import '../vendors.css';

export const metadata: Metadata = { title: 'Labour vs contract', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const pct = (bp: number | null) => (bp === null ? '—' : `${(bp / 100).toFixed(1)}%`);

/**
 * Labour against the contract (Studio OS Phase 3 §5), the owner's alone: per
 * live project, the contract, what the crews were expected to cost on the
 * quotation's quantities, what the work orders come to now (committed), what
 * is paid, and the labour margin, with a warning below the studio's target
 * (Settings, Crews and trades). Material is not counted here, so this is the
 * labour margin, not the profit.
 */
export default async function LabourPage() {
  const data = await labourOverview();
  if (!data) {
    return (
      <main className="content ox-page">
        <p className="ox-note">Labour against the contract is the studio owner&apos;s.</p>
      </main>
    );
  }
  const low = data.rows.filter((r) => r.warn).length;
  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <h1>Labour vs contract</h1>
          <p className="muted">
            Margin after crews, lowest first. Target {data.targetPct}% of the contract{low ? ` · ${low} below it` : ''}. Material is not counted.
          </p>
        </div>
        {low ? (
          <span className="chip bad">
            <span className="dot" />
            {low} below {data.targetPct}%
          </span>
        ) : null}
      </div>
      {data.rows.length === 0 ? (
        <div className="empty">
          <b>No project has work orders yet.</b>
        </div>
      ) : (
        <section className="card flush" aria-label="Labour by project">
          <div className="tscroll">
            <table className="tbl" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  {['Contract', 'Expected', 'Committed', 'Paid', 'Margin'].map((h) => (
                    <th key={h} scope="col" style={{ textAlign: 'right' }}>
                      {h}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">Warning</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.projectId}>
                    <td>
                      <Link href={`/studio/projects/${r.projectId}?tab=crews`} style={{ fontWeight: 600 }}>
                        {r.projectName}
                      </Link>
                      <div className="muted sm">
                        {r.orders} work order{r.orders === 1 ? '' : 's'}
                        {r.pendingLines ? ` · +${r.pendingLines} to price` : ''}
                        {r.extrasPaise ? ` · extras ${formatINR(r.extrasPaise)}` : ''}
                      </div>
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {r.contractPaise === null ? '—' : formatINR(r.contractPaise)}
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {formatINR(r.expectedPaise)}
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {formatINR(r.committedPaise)}
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {formatINR(r.paidPaise)}
                    </td>
                    <td className={`mono${r.warn ? ' bad-t' : ''}`} style={{ textAlign: 'right', fontWeight: 600 }}>
                      {r.marginPaise === null ? '—' : formatINR(r.marginPaise)}
                      <div className="sm" style={{ fontWeight: 400 }}>
                        {pct(r.marginBp)}
                      </div>
                    </td>
                    <td>
                      {r.warn ? (
                        <span className="chip bad">
                          <span className="dot" />
                          Below {data.targetPct}%
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
