import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageBody } from '../../StudioShell';
import { formatINR } from '@/lib/money';
import { crewDetail } from '@/modules/studio-crews/store';
import { KYC_DOCS } from '@/modules/studio-crews/kyc';
import { tradeLabel } from '@/modules/studio-crews/trades';
import { ArchiveCrew, CrewForm, KycScan, RateCard } from '../CrewForms';
import { WorkOrderCard } from '../crews-ui';
import { dayWords } from '../format';

export const metadata: Metadata = { title: 'Crew', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * One crew (Studio OS Phase 3): who they are and how to pay them, their KYC
 * scans (private; owner and accounts), their rate card, their work orders on
 * every live project, and every payment — the crew's statement on screen.
 */
export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await crewDetail(id.slice(0, 64));
  if (!c) notFound();
  const card = 'flex flex-col gap-1 s-card p-4';
  return (
    <>
      <div className="border-b border-[var(--s-rule)] bg-[var(--s-rail)]/50 px-5 py-4 sm:px-7">
        <Link href="/studio/vendors" className="text-[13px] text-[var(--s-ink-3)] no-underline hover:text-[var(--s-accent)]">
          ← Crews
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-[22px] font-semibold tracking-tight">{c.name}</h1>
            <p className="m-0 mt-1 text-[13.5px] text-[var(--s-ink-2)]">
              {[c.trades.map((t) => tradeLabel(c.settings.trades, t)).join(', '), c.kind === 'PERMANENT' ? 'Permanent' : 'Temporary', c.workingSince ? `working with you since ${c.workingSince}` : null, c.phone]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <ArchiveCrew id={c.id} archived={c.archived} />
        </div>
      </div>
      <PageBody>
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={card}>
              <span className="s-label">Billed</span>
              <span className="s-num font-[family-name:var(--font-mono)] text-[18px] font-semibold">{formatINR(c.totals.billPaise)}</span>
              <span className="text-[12.5px] text-[var(--s-ink-3)]">{c.orders.length} work order{c.orders.length === 1 ? '' : 's'}</span>
            </div>
            <div className={card}>
              <span className="s-label">Paid</span>
              <span className="s-num font-[family-name:var(--font-mono)] text-[18px] font-semibold">{formatINR(c.totals.paidPaise)}</span>
              <span className="text-[12.5px] text-[var(--s-ink-3)]">{c.payments.length} entr{c.payments.length === 1 ? 'y' : 'ies'}</span>
            </div>
            <div className={card}>
              <span className="s-label">Running balance</span>
              <span className="s-num font-[family-name:var(--font-mono)] text-[18px] font-semibold">{formatINR(c.totals.balancePaise)}</span>
              <span className="text-[12.5px] text-[var(--s-ink-3)]">{c.totals.open ? `across ${c.totals.open} open work order${c.totals.open === 1 ? '' : 's'}` : 'everything settled'}</span>
            </div>
          </div>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="s-card p-5">
              <h2 className="m-0 mb-1 text-[16px] font-semibold">Details</h2>
              <p className="m-0 mb-3 text-[12.5px] text-[var(--s-ink-3)]">
                {c.kyc.label}
                {c.panNumber ? ` · PAN ${c.panNumber}${c.panHolder ? ` (${c.panHolder})` : ''}` : ''}
                {c.hasAadhaar ? ` · Aadhaar ${c.aadhaar}` : ''}
                {c.kycCheckedAt ? ` · checked ${dayWords(c.kycCheckedAt)}` : ''}
              </p>
              <CrewForm
                trades={c.settings.trades}
                initial={{
                  id: c.id,
                  name: c.name,
                  kind: c.kind,
                  trades: c.trades,
                  phone: c.phone ?? '',
                  altPhone: c.altPhone ?? '',
                  address: c.address ?? '',
                  workingSince: c.workingSince ?? '',
                  notes: c.notes ?? '',
                  panNumber: c.panNumber,
                  aadhaarMasked: c.hasAadhaar ? c.aadhaar : null,
                  upiId: c.upiId ?? '',
                  bankAccountName: c.bankAccountName ?? '',
                  bankAccountNumber: c.bankAccountNumber ?? '',
                  bankIfsc: c.bankIfsc ?? '',
                }}
              />
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="m-0 text-[16px] font-semibold">Scans</h2>
              <p className="m-0 text-[12.5px] text-[var(--s-ink-3)]">Private: only the owner and accounts can open them. JPG, PNG, WebP or PDF, up to 3.8 MB.</p>
              {KYC_DOCS.map((d) => {
                const doc = c.docs.find((x) => x.doc === d)!;
                return <KycScan key={d} crewId={c.id} doc={d} onFile={doc.onFile} link={doc.link} />;
              })}
            </div>
          </section>

          <section className="s-card p-5">
            <h2 className="m-0 mb-1 text-[16px] font-semibold">Rate card</h2>
            <p className="m-0 mb-3 text-[12.5px] text-[var(--s-ink-3)]">
              Lines with width × height are priced as sq ft × these rates when a work order is raised. A blank rate means &ldquo;agree it per job&rdquo;.
            </p>
            <RateCard crewId={c.id} rates={c.rates} trades={c.settings.trades} crewTrades={c.trades} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="m-0 text-[16px] font-semibold">Work orders</h2>
            {c.orders.length === 0 ? (
              <p className="m-0 text-[13.5px] text-[var(--s-ink-3)]">None yet. Work orders are raised on a project&apos;s Crews tab.</p>
            ) : (
              <ul className="m-0 flex flex-col gap-2 p-0">
                {c.orders.map((o) => (
                  <WorkOrderCard key={o.id} order={o} projectId={o.projectId} canBuild={false} seesMoney canPay advanceLimitPaise={c.settings.advanceLimitPaise} showProject />
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="m-0 text-[16px] font-semibold">Payment ledger</h2>
            {c.payments.length === 0 ? (
              <p className="m-0 text-[13.5px] text-[var(--s-ink-3)]">Nothing paid yet.</p>
            ) : (
              <div className="s-card overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
                  <tbody>
                    {c.payments.map((p) => (
                      <tr key={p.id} className="border-t border-[var(--s-rule)] first:border-t-0">
                        <td className="s-num px-4 py-2.5">{dayWords(p.paidOn)}</td>
                        <td className="px-4 py-2.5">{p.projectName}</td>
                        <td className="px-4 py-2.5 text-[var(--s-ink-2)]">
                          {p.kind === 'ADVANCE' ? 'Advance' : p.kind === 'CORRECTION' ? 'Correction' : (p.note ?? 'Payment')} · {p.mode}
                        </td>
                        <td className="s-num px-4 py-2.5 text-right font-[family-name:var(--font-mono)]">{formatINR(p.amountPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </PageBody>
    </>
  );
}
