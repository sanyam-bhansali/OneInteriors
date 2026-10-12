import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { workOrderPage } from '@/modules/studio-crews/store';
import { WorkOrderCard } from '../../crews-ui';
import '../../../office-ui.css';
import '../../vendors.css';

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
    <main className="content ox-page">
      <div className="phead">
        <div>
          <Link href="/studio/vendors/pay" className="vd-back">
            ← Pay crews
          </Link>
          <h1 style={{ marginTop: 4 }}>
            <span className="mono">WO-{o.number}</span> · {o.crewName}
          </h1>
          <p className="muted">{o.projectName}</p>
        </div>
      </div>
      <ul className="vd-orders">
        <WorkOrderCard order={o} projectId={o.projectId} canBuild={data.canBuild} seesMoney={data.seesMoney} canPay={data.canPay} advanceLimitPaise={data.advanceLimitPaise} payee={data.payee} open />
      </ul>
    </main>
  );
}
