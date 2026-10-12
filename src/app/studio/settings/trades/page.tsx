import type { Metadata } from 'next';
import { crewSettingsPage } from '@/modules/studio-crews/store';
import { TradesForm } from './TradesForm';

export const metadata: Metadata = { title: 'Crews and trades', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Crews and trades (Studio OS Phase 3 §1–2, §7). The owner's: the
 * trades, routing quotation lines to them, rate templates, the due days, the
 * labour target, the advance limit, the installation rate, and the execution
 * steps that wait for a client payment.
 */
export default async function TradesSettingsPage() {
  const data = await crewSettingsPage();
  return (
    <>
      <div className="max-w-[60rem]">
        {!data ? (
          <p className="m-0 text-[14.5px] muted">Only the studio owner sets the trades and crew settings.</p>
        ) : (
          <TradesForm initial={data.settings} inUse={data.inUse} paymentLabels={data.paymentLabels} />
        )}
      </div>
    </>
  );
}
