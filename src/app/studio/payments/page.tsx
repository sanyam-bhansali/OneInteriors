import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../StudioShell';
import { formatINR } from '@/lib/money';
import { paymentsDesk } from '@/modules/project/payments-flow';
import { PaymentsBody } from '../projects/[id]/PaymentsTab';

export const metadata: Metadata = { title: 'Payments', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Where an accounts member lands (studio workspace Phase 5): every project's
 * money, computed from the payment rows — what is paid, what is waiting for
 * the customer's confirmation, what is owed — with "Mark a payment received"
 * on each, the same control as the project's Payments tab, so there is one
 * way to record money. Nothing else of the project is read for this screen
 * (studio/roles.ts: accounts sees payments across all projects, nothing
 * else). The projects needing attention come first: a payment the customer
 * says they did not make, then money waiting for their yes.
 */
export default async function PaymentsDeskPage() {
  const projects = await paymentsDesk();
  const weight = (p: (typeof projects)[number]) => {
    const rows = p.payments?.rows ?? [];
    if (rows.some((r) => r.status === 'disputed')) return 0;
    if (rows.some((r) => r.status === 'waiting')) return 1;
    return (p.payments?.ledger.balancePaise ?? 0) > 0 ? 2 : 3;
  };
  const sorted = [...projects].sort((a, b) => weight(a) - weight(b));
  const owed = projects.reduce((n, p) => n + Math.max(0, p.payments?.ledger.balancePaise ?? 0), 0);
  const waiting = projects.reduce((n, p) => n + (p.payments?.ledger.waitingPaise ?? 0), 0);
  const disputed = projects.filter((p) => weight(p) === 0).length;

  return (
    <>
      <PageHead
        title="Payments"
        sub="Every project’s payment stages. Record money the day it arrives, with the receipt; the customer confirms it in the app, and it files in their locker."
      />
      <PageBody>
        {projects.length === 0 ? (
          <p className="m-0 text-[15px] text-[var(--s-ink-2)]">No projects yet. A project appears here once a client signs with your studio.</p>
        ) : (
          <div className="flex flex-col gap-5">
            <dl className="m-0 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="s-card p-4">
                <dt className="text-[12.5px] font-semibold text-[var(--s-ink-2)]">Still to come in</dt>
                <dd className="s-num m-0 mt-1 font-[family-name:var(--font-mono)] text-[18px] font-semibold">{formatINR(owed)}</dd>
              </div>
              <div className="s-card p-4">
                <dt className="text-[12.5px] font-semibold text-[var(--s-ink-2)]">Recorded, waiting for the customer to confirm</dt>
                <dd className="s-num m-0 mt-1 font-[family-name:var(--font-mono)] text-[18px] font-semibold">{formatINR(waiting)}</dd>
              </div>
              <div className="s-card p-4">
                <dt className="text-[12.5px] font-semibold text-[var(--s-ink-2)]">Customer says not paid</dt>
                <dd className="m-0 mt-1 text-[18px] font-semibold" style={{ color: disputed ? 'var(--s-bad)' : undefined }}>
                  {disputed ? `${disputed} project${disputed === 1 ? '' : 's'}` : 'None'}
                </dd>
                {disputed ? <dd className="m-0 text-[12.5px] text-[var(--s-ink-3)]">One Interiors is looking into it and will call you.</dd> : null}
              </div>
            </dl>
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {sorted.map((p) => (
                <li key={p.id} className="s-card p-5">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="m-0 text-[16px] font-semibold">
                      {p.label} <span className="text-[14px] font-normal text-[var(--s-ink-3)]">· {p.customer}</span>
                    </p>
                    {p.canOpen ? (
                      <Link href={`/studio/projects/${p.id}?tab=payments`} className="text-[13px] text-[var(--s-accent)]">
                        Open the project
                      </Link>
                    ) : null}
                  </div>
                  {p.payments ? (
                    <PaymentsBody data={p.payments} customer={p.customer.split(/\s+/)[0] ?? p.customer} />
                  ) : (
                    <p className="m-0 text-[14px] text-[var(--s-ink-3)]">No payment stages were signed in the app for this project.</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </PageBody>
    </>
  );
}
