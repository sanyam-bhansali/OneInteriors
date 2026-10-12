'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CREW_UNIT_SHORT, type CrewUnitName } from '@/modules/studio-crews/trades';
import { setLinePriceAction, setLineQtyAction } from '../actions';
import { Message, useRun } from '../crews-ui';
import { muted, rupees } from '../format';

export interface PriceRowView {
  lineId: string;
  workOrderId: string;
  projectId: string;
  projectName: string;
  crewName: string;
  room: string;
  product: string;
  tradeLabel: string;
  item: string;
  unit: CrewUnitName;
  ratePaise: number | null;
  quotedAmountPaise: number | null;
  size: string | null;
  isExtra: boolean;
}

/**
 * "Price these": a line at a time, saved when the field is left. A saved row
 * fades out — this list is the whole manual workload the software leaves.
 */
export function PriceRows({ rows, kind }: { rows: PriceRowView[]; kind: 'price' | 'qty' }) {
  return (
    <div className="s-card overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
        <thead>
          <tr className="text-left">
            {['Project · crew', 'Line', 'Client ₹', 'Crew item', kind === 'price' ? 'Rate or agreed amount' : 'Quantity'].map((h) => (
              <th key={h} className="s-label px-3 py-2.5 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.lineId} r={r} kind={kind} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ r, kind }: { r: PriceRowView; kind: 'price' | 'qty' }) {
  const run = useRun();
  const [gone, setGone] = useState(false);
  const [rate, setRate] = useState('');
  const [agreed, setAgreed] = useState('');
  const [qty, setQty] = useState('');
  if (gone) return null;
  const td = 'border-t border-[var(--s-rule)] px-3 py-2.5 align-top';
  return (
    <tr>
      <td className={td}>
        <Link href={`/studio/vendors/orders/${r.workOrderId}`} className="text-[var(--s-ink)] no-underline hover:text-[var(--s-accent)]">
          {r.projectName}
        </Link>
        <span className={`block ${muted}`}>{r.crewName}</span>
      </td>
      <td className={td}>
        {r.product}
        {r.isExtra ? <span className="s-tag ml-1.5">Extra</span> : null}
        <span className={`block ${muted}`}>
          {r.room} · {r.tradeLabel}
          {r.size ? ` · ${r.size}` : ''}
        </span>
      </td>
      <td className={`${td} s-num`}>{r.isExtra ? <span className={muted}>not quoted</span> : rupees(r.quotedAmountPaise)}</td>
      <td className={td}>
        {r.item}
        <span className={`block ${muted}`}>{r.ratePaise !== null ? `${rupees(r.ratePaise)}/${CREW_UNIT_SHORT[r.unit]}` : `per ${CREW_UNIT_SHORT[r.unit]}`}</span>
      </td>
      <td className={td}>
        {kind === 'qty' ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              run.run(() => setLineQtyAction(r.projectId, r.lineId, { estimate: qty }), () => setGone(true));
            }}
          >
            <input className="s-input s-num w-[90px]" inputMode="decimal" aria-label={`Quantity for ${r.product}`} placeholder={CREW_UNIT_SHORT[r.unit]} value={qty} onChange={(e) => setQty(e.target.value)} />
            <button type="submit" className="s-btn-ghost" disabled={run.pending || !qty}>
              Save
            </button>
          </form>
        ) : (
          <form
            className="flex flex-wrap items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              run.run(() => setLinePriceAction(r.projectId, r.lineId, agreed ? { agreedRupees: agreed } : { rateRupees: rate }), () => setGone(true));
            }}
          >
            <input className="s-input s-num w-[90px]" inputMode="decimal" aria-label={`Rate for ${r.product}`} placeholder={`₹/${CREW_UNIT_SHORT[r.unit]}`} value={rate} onChange={(e) => setRate(e.target.value)} />
            <span className={muted}>or</span>
            <input className="s-input s-num w-[100px]" inputMode="decimal" aria-label={`Agreed amount for ${r.product}`} placeholder="Agreed ₹" value={agreed} onChange={(e) => setAgreed(e.target.value)} />
            <button type="submit" className="s-btn-ghost" disabled={run.pending || (!rate && !agreed)}>
              Save
            </button>
          </form>
        )}
        <Message m={run.message} />
      </td>
    </tr>
  );
}
