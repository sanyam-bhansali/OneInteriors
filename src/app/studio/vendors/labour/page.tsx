import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../../StudioShell';
import { formatINR } from '@/lib/money';
import { labourOverview } from '@/modules/studio-crews/store';
import { CrewsNav } from '../CrewsNav';

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
      <PageBody>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">Labour against the contract is the studio owner&apos;s.</p>
      </PageBody>
    );
  }
  const low = data.rows.filter((r) => r.warn).length;
  return (
    <>
      <PageHead title="Labour vs contract" sub={`Margin after crews, lowest first. Target ${data.targetPct}% of the contract${low ? ` · ${low} below it` : ''}. Material is not counted.`} />
      <CrewsNav at="labour" />
      <PageBody>
        {data.rows.length === 0 ? (
          <p className="s-card m-0 p-5 text-[14px] text-[var(--s-ink-2)]">No project has work orders yet.</p>
        ) : (
          <div className="s-card overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-[13.5px]">
              <thead>
                <tr className="text-left">
                  {['Project', 'Contract', 'Expected', 'Committed', 'Paid', 'Margin', ''].map((h, i) => (
                    <th key={i} className={`s-label px-3 py-2.5 font-normal ${i > 0 && i < 6 ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.projectId} className="border-t border-[var(--s-rule)]">
                    <td className="px-3 py-2.5">
                      <Link href={`/studio/projects/${r.projectId}?tab=crews`} className="text-[var(--s-ink)] no-underline hover:text-[var(--s-accent)]">
                        {r.projectName}
                      </Link>
                      <span className="block text-[12px] text-[var(--s-ink-3)]">
                        {r.orders} work order{r.orders === 1 ? '' : 's'}
                        {r.pendingLines ? ` · +${r.pendingLines} to price` : ''}
                        {r.extrasPaise ? ` · extras ${formatINR(r.extrasPaise)}` : ''}
                      </span>
                    </td>
                    <td className="s-num px-3 py-2.5 text-right font-[family-name:var(--font-mono)]">{r.contractPaise === null ? '—' : formatINR(r.contractPaise)}</td>
                    <td className="s-num px-3 py-2.5 text-right font-[family-name:var(--font-mono)]">{formatINR(r.expectedPaise)}</td>
                    <td className="s-num px-3 py-2.5 text-right font-[family-name:var(--font-mono)]">{formatINR(r.committedPaise)}</td>
                    <td className="s-num px-3 py-2.5 text-right font-[family-name:var(--font-mono)]">{formatINR(r.paidPaise)}</td>
                    <td className="s-num px-3 py-2.5 text-right font-[family-name:var(--font-mono)] font-semibold" style={r.warn ? { color: 'var(--s-bad)' } : undefined}>
                      {r.marginPaise === null ? '—' : formatINR(r.marginPaise)}
                      <span className="block text-[12px] font-normal">{pct(r.marginBp)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px]" style={{ color: 'var(--s-bad)' }}>
                      {r.warn ? `Below ${data.targetPct}%` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
    </>
  );
}
