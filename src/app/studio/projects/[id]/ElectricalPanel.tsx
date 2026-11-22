'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ElectricalBillView } from '@/modules/project/electrical-bill';
import { electricalAmount, parseQty, qtyWords, type ElectricalItem } from '@/modules/project/electrical-rules';
import { cancelElectricalAction, saveElectricalAction, sendElectricalAction } from './electrical-actions';

type Data = { bills: ElectricalBillView[]; items: ElectricalItem[]; canWrite: boolean; open: string | null; gstBps: number };
type Row = { key: string; itemId: string; qty: string; note: string };
type Result = { ok: true; message: string; id?: string } | { ok: false; error: string };

const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
const STATUS: Record<string, { words: string; chip: string }> = {
  DRAFT: { words: 'Draft', chip: 'chip' },
  SENT_TO_CLIENT: { words: 'With the client', chip: 'chip warn' },
  APPROVED: { words: 'Approved · in the payment stages', chip: 'chip good' },
  PAID: { words: 'Approved · in the payment stages', chip: 'chip good' },
  DECLINED: { words: 'Declined', chip: 'chip bad' },
  CANCELLED: { words: 'Cancelled', chip: 'chip' },
  RELEASED: { words: 'Released', chip: 'chip' },
};
let seq = 0;
const newRow = (itemId = ''): Row => ({ key: `r${++seq}`, itemId, qty: '', note: '' });

/**
 * The Electrical bill tab (owner, 22 Nov 2026: "like our quotation builder but
 * very easy"): pick an item from the electrical rate list (description, unit
 * and rate come with it), set the quantity, add a note; save, then send to
 * the client. Once they approve it in the app, it is spread over the unpaid
 * payment stages and joins the project value.
 */
export function ElectricalPanel({ projectId, data, customer }: { projectId: string; data: Data; customer: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id?: string; rows: Row[] } | null>(null);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  const live = data.bills.filter((b) => b.status !== 'CANCELLED');
  return (
    <div className="flex flex-col gap-3">
      <section className="card flex flex-col gap-1">
        <h2 className="m-0 text-[15px] font-semibold">Electrical bill</h2>
        <p className="m-0 muted text-[13.5px]">
          Pick items from the{' '}
          <Link href="/studio/products/electrical" className="underline">
            electrical rate list
          </Link>{' '}
          and set the quantities. Send it to {customer}; once they approve it in the app, it is added to the project value and spread over the payment stages not yet paid.
        </p>
        {data.open ? <p className="m-0 text-[13px]" style={{ color: 'var(--bad)' }}>{data.open}</p> : null}
        {data.items.length === 0 ? <p className="m-0 text-[13px]" style={{ color: 'var(--bad)' }}>The electrical rate list is empty: the owner or the design head adds the items first.</p> : null}
      </section>

      {msg ? (
        <p role="status" className="m-0 text-[13px]" style={{ color: msg.ok ? 'var(--good)' : 'var(--bad)' }}>
          {msg.text}
        </p>
      ) : null}

      {editing ? (
        <Builder
          items={data.items}
          gstBps={data.gstBps}
          initial={editing.rows}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={(rows) => run(() => saveElectricalAction(projectId, { id: editing.id, lines: rows.map((r) => ({ itemId: r.itemId, qty: r.qty, note: r.note })) }), () => setEditing(null))}
        />
      ) : data.canWrite && !data.open && data.items.length > 0 ? (
        <div>
          <button type="button" className="btn pri sm" onClick={() => setEditing({ rows: [newRow()] })}>
            New electrical bill
          </button>
        </div>
      ) : null}

      {live.map((b) => (
        <section key={b.id} className="card flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-[14.5px] font-semibold">
              Electrical bill {b.number} · {inr(b.totalPaise)}
            </h3>
            <span className={STATUS[b.status]?.chip ?? 'chip'}>{STATUS[b.status]?.words ?? b.status}</span>
          </div>
          <BillTable bill={b} />
          {b.declineReason ? <p className="m-0 text-[13px]">Why declined: {b.declineReason}</p> : null}
          {data.canWrite ? (
            <div className="flex flex-wrap gap-2">
              {b.status === 'DRAFT' ? (
                <>
                  <button
                    type="button"
                    className="btn sec sm"
                    disabled={pending}
                    onClick={() => setEditing({ id: b.id, rows: b.lines.map((l) => ({ key: `r${++seq}`, itemId: l.itemId ?? '', qty: String(l.qtyMilli / 1000), note: l.note ?? '' })) })}
                  >
                    Edit
                  </button>
                  <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => sendElectricalAction(projectId, b.id))}>
                    Send to {customer}
                  </button>
                </>
              ) : null}
              {b.status === 'DRAFT' || b.status === 'SENT_TO_CLIENT' ? (
                <button type="button" className="btn ghost sm" disabled={pending} onClick={() => window.confirm('Cancel this electrical bill?') && run(() => cancelElectricalAction(projectId, b.id))}>
                  Cancel
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function BillTable({ bill }: { bill: ElectricalBillView }) {
  return (
    <table className="w-full text-[13.5px]">
      <thead>
        <tr className="muted text-left">
          <th>Item</th>
          <th>Quantity</th>
          <th>Rate</th>
          <th className="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {bill.lines.map((l, i) => (
          <tr key={i} className="align-top">
            <td>
              {l.product}
              {l.details ? <span className="block muted text-[12.5px]">{l.details}</span> : null}
              {l.note ? <span className="block text-[12.5px]">Note: {l.note}</span> : null}
            </td>
            <td>{qtyWords(l.qtyMilli, l.unitLabel)}</td>
            <td className="mono">{inr(l.ratePaise)}</td>
            <td className="mono text-right">{inr(l.amountPaise)}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={3} className="text-right muted">
            Work
          </td>
          <td className="mono text-right">{inr(bill.workPaise)}</td>
        </tr>
        {bill.gstPaise ? (
          <tr>
            <td colSpan={3} className="text-right muted">
              GST ({bill.gstBps / 100}%)
            </td>
            <td className="mono text-right">{inr(bill.gstPaise)}</td>
          </tr>
        ) : null}
        <tr>
          <td colSpan={3} className="text-right font-semibold">
            Total
          </td>
          <td className="mono text-right font-semibold">{inr(bill.totalPaise)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Builder({
  items,
  gstBps,
  initial,
  pending,
  onCancel,
  onSave,
}: {
  items: ElectricalItem[];
  gstBps: number;
  initial: Row[];
  pending: boolean;
  onCancel: () => void;
  onSave: (rows: Row[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const set = (key: string, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  // Shown as it will be priced: the server prices again from the rate list.
  const amounts = rows.map((r) => {
    const item = byId.get(r.itemId);
    const q = parseQty(r.qty);
    return item && q !== null ? electricalAmount(item.ratePaise, q) : 0;
  });
  const work = amounts.reduce((a, b) => a + b, 0);
  const gst = Math.round((work * gstBps) / 10_000);
  return (
    <form
      className="card flex flex-col gap-2"
      aria-label="Electrical bill"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(rows.filter((r) => r.itemId));
      }}
    >
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="muted text-left">
            <th>Item</th>
            <th style={{ width: 110 }}>Quantity</th>
            <th>Rate</th>
            <th className="text-right">Amount</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const item = byId.get(r.itemId);
            return (
              <tr key={r.key} className="align-top">
                <td>
                  <select className="fld w-full" value={r.itemId} onChange={(e) => set(r.key, { itemId: e.target.value })} aria-label={`Line ${i + 1} item`}>
                    <option value="">Pick an item</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                  {item?.details ? <span className="block muted text-[12.5px]">{item.details}</span> : null}
                  <input className="fld mt-1 w-full" value={r.note} maxLength={200} onChange={(e) => set(r.key, { note: e.target.value })} placeholder="Note (optional): which room, height, position…" aria-label={`Line ${i + 1} note`} />
                </td>
                <td>
                  <input className="fld w-full" inputMode="decimal" value={r.qty} onChange={(e) => set(r.key, { qty: e.target.value })} placeholder="0" aria-label={`Line ${i + 1} quantity`} />
                  {item ? <span className="block muted text-[12px]">{item.unit}</span> : null}
                </td>
                <td className="mono">{item ? inr(item.ratePaise) : '—'}</td>
                <td className="mono text-right">{amounts[i] ? inr(amounts[i]!) : '—'}</td>
                <td>
                  {rows.length > 1 ? (
                    <button type="button" className="btn ghost sm" onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))} aria-label={`Remove line ${i + 1}`}>
                      ✕
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div>
        <button type="button" className="btn ghost sm" onClick={() => setRows((list) => [...list, newRow()])}>
          + Add a line
        </button>
      </div>
      <p className="m-0 text-right text-[13.5px]">
        Work <b className="mono">{inr(work)}</b>
        {gstBps ? (
          <>
            {' '}
            · GST {gstBps / 100}% <b className="mono">{inr(gst)}</b>
          </>
        ) : null}{' '}
        · Total <b className="mono">{inr(work + gst)}</b>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn pri sm" disabled={pending || !rows.some((r) => r.itemId)}>
          {pending ? 'Saving…' : 'Save draft'}
        </button>
        <button type="button" className="btn ghost sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
