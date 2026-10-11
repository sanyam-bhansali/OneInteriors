'use client';

import { useState } from 'react';
import { HAUSPIRE_TEMPLATE, type PaymentStage } from '@/modules/studio-sales/payment-template';
import { savePaymentStagesAction } from '../../sales-actions';
import { PaymentStagesEditor } from '../../PaymentStagesEditor';
import { Said, useAct, primaryClass, quietClass } from '../../SalesUi';

/** The owner's payment stages, with a live check and one Save. */
export function StagesForm({ initial }: { initial: PaymentStage[] }) {
  const [stages, setStages] = useState<PaymentStage[]>(initial);
  const { pending, result, run } = useAct();
  return (
    <div className="s-card flex flex-col gap-4 p-5">
      <PaymentStagesEditor stages={stages} onChange={setStages} totalPaise={100_000_000} />
      <p className="m-0 text-[12.5px] text-[var(--s-ink-3)]">The rupee figures show a ₹10 lakh contract, as an example.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => savePaymentStagesAction(stages))} className={primaryClass}>
          {pending ? 'Saving…' : 'Save payment stages'}
        </button>
        <button type="button" disabled={pending} onClick={() => setStages(HAUSPIRE_TEMPLATE.map((s) => ({ ...s })))} className={quietClass}>
          Start again from Hauspire’s six
        </button>
      </div>
      <Said result={result} />
    </div>
  );
}
