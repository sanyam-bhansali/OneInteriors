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
    <div className="tscroll">
      <table className="tbl vd-lines" style={{ minWidth: 760 }}>
        <thead>
          <tr>
            {['Project · crew', 'Line', 'Client ₹', 'Crew item', kind === 'price' ? 'Rate or agreed amount' : 'Quantity'].map((h) => (
              <th key={h} scope="col">
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
  return (
    <tr>
      <td>
        <Link href={`/studio/vendors/orders/${r.workOrderId}`} style={{ fontWeight: 600 }}>
          {r.projectName}
        </Link>
        <span className={muted} style={{ display: 'block' }}>
          {r.crewName}
        </span>
      </td>
      <td>
        {r.product}
        {r.isExtra ? (
          <span className="chip" style={{ marginLeft: 6 }}>
            Extra
          </span>
        ) : null}
        <span className={muted} style={{ display: 'block' }}>
          {r.room} · {r.tradeLabel}
          {r.size ? ` · ${r.size}` : ''}
        </span>
      </td>
      <td className="mono">{r.isExtra ? <span className={muted}>not quoted</span> : rupees(r.quotedAmountPaise)}</td>
      <td>
        {r.item}
        <span className={muted} style={{ display: 'block' }}>
          {r.ratePaise !== null ? `${rupees(r.ratePaise)}/${CREW_UNIT_SHORT[r.unit]}` : `per ${CREW_UNIT_SHORT[r.unit]}`}
        </span>
      </td>
      <td>
        {kind === 'qty' ? (
          <form
            className="hstack"
            style={{ gap: 6 }}
            onSubmit={(e) => {
              e.preventDefault();
              run.run(() => setLineQtyAction(r.projectId, r.lineId, { estimate: qty }), () => setGone(true));
            }}
          >
            <input className="fld sm fit num" size={7} inputMode="decimal" aria-label={`Quantity for ${r.product}`} placeholder={CREW_UNIT_SHORT[r.unit]} value={qty} onChange={(e) => setQty(e.target.value)} />
            <button type="submit" className="btn pri sm" disabled={run.pending || !qty}>
              Save
            </button>
          </form>
        ) : (
          <form
            className="hstack"
            style={{ gap: 6 }}
            onSubmit={(e) => {
              e.preventDefault();
              run.run(() => setLinePriceAction(r.projectId, r.lineId, agreed ? { agreedRupees: agreed } : { rateRupees: rate }), () => setGone(true));
            }}
          >
            <input className="fld sm fit num" size={7} inputMode="decimal" aria-label={`Rate for ${r.product}`} placeholder={`₹/${CREW_UNIT_SHORT[r.unit]}`} value={rate} onChange={(e) => setRate(e.target.value)} />
            <span className={muted}>or</span>
            <input className="fld sm fit num" size={8} inputMode="decimal" aria-label={`Agreed amount for ${r.product}`} placeholder="Agreed ₹" value={agreed} onChange={(e) => setAgreed(e.target.value)} />
            <button type="submit" className="btn pri sm" disabled={run.pending || (!rate && !agreed)}>
              Save
            </button>
          </form>
        )}
        <Message m={run.message} />
      </td>
    </tr>
  );
}
