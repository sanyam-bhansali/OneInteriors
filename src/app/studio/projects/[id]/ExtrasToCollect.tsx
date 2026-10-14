'use client';

/**
 * Approved extra work still to be paid (change orders, 15 Oct 2026), on the
 * accounts payments desk: record the money with the same recording as any
 * payment; once it covers the extra work, the studio can release it.
 */

import { useState } from 'react';
import { formatINR } from '@/lib/money';
import type { ExtraToCollect } from '@/modules/project/change-orders';
import { RecordExtraPayment } from './ExtrasPanel';

export function ExtrasToCollect({ items, canRecord }: { items: ExtraToCollect[]; canRecord: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="banner" role="status" data-testid="extras-to-collect" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'var(--warn-bg)', color: 'var(--ink)' }}>
      <b>Extra work approved by the client, to collect</b>
      {items.map((x) => (
        <div key={x.id} className="flex flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2 sm">
            <span>
              Extra work {x.number}: {x.title} · <span className="mono">{formatINR(x.totalPaise)}</span>
              {x.paid.recordedPaise > 0 ? ` · ${formatINR(x.paid.recordedPaise)} recorded` : ''}
            </span>
            {canRecord && open !== x.id ? (
              <button type="button" className="btn pri sm" onClick={() => setOpen(x.id)}>
                Record payment
              </button>
            ) : null}
          </span>
          {open === x.id ? <RecordExtraPayment projectId={x.projectId} e={x} onDone={() => setOpen(null)} /> : null}
        </div>
      ))}
    </div>
  );
}
