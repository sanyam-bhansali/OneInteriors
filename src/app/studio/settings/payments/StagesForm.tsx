'use client';

import { useState } from 'react';
import { HAUSPIRE_TEMPLATE, type PaymentStage } from '@/modules/studio-sales/payment-template';
import { savePaymentStagesAction } from '../../sales-actions';
import { PaymentStagesEditor } from '../../PaymentStagesEditor';
import { Said, useAct } from '../../SalesUi';

/** The owner's payment stages, with a live check and one Save. */
export function StagesForm({ initial }: { initial: PaymentStage[] }) {
  const [stages, setStages] = useState<PaymentStage[]>(initial);
  const { pending, result, run } = useAct();
  return (
    <div className="card flex flex-col gap-4 p-5">
      <PaymentStagesEditor stages={stages} onChange={setStages} totalPaise={100_000_000} />
      <p className="m-0 text-[12.5px] muted">The rupee figures show a ₹10 lakh contract, as an example.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => savePaymentStagesAction(stages))} className="btn pri sm">
          {pending ? 'Saving…' : 'Save payment stages'}
        </button>
        <button type="button" disabled={pending} onClick={() => setStages(HAUSPIRE_TEMPLATE.map((s) => ({ ...s })))} className="btn ghost sm">
          Start again from Hauspire’s six
        </button>
      </div>
      <Said result={result} />
    </div>
  );
}
