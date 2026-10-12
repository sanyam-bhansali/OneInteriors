import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageBody } from '../../../StudioShell';
import { workOrderPage } from '@/modules/studio-crews/store';
import { WorkOrderCard } from '../../crews-ui';

export const metadata: Metadata = { title: 'Work order', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * One work order, opened from Pay these, Price these or a crew's page — the
 * way accounts reaches it (accounts does not open projects). The same card as
 * the project's Crews tab, opened, with Record payment.
 */
export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await workOrderPage(id.slice(0, 64));
  if (!data) notFound();
  const o = data.order;
  return (
    <>
      <div className="border-b border-[var(--s-rule)] bg-[var(--s-rail)]/50 px-5 py-4 sm:px-7">
        <Link href="/studio/vendors/pay" className="text-[13px] text-[var(--s-ink-3)] no-underline hover:text-[var(--s-accent)]">
          ← Pay these
        </Link>
        <h1 className="m-0 mt-1 text-[22px] font-semibold tracking-tight">
          WO-{o.number} · {o.crewName}
        </h1>
        <p className="m-0 mt-1 text-[13.5px] text-[var(--s-ink-2)]">{o.projectName}</p>
      </div>
      <PageBody>
        <ul className="m-0 flex max-w-[64rem] flex-col p-0">
          <WorkOrderCard order={o} projectId={o.projectId} canBuild={data.canBuild} seesMoney={data.seesMoney} canPay={data.canPay} advanceLimitPaise={data.advanceLimitPaise} payee={data.payee} open />
        </ul>
      </PageBody>
    </>
  );
}
