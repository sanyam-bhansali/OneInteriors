'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ElectricalBillView } from '@/modules/project/electrical-bill';
import { byRoom, DEFAULT_DISCOUNT_BPS, electricalAmount, electricalTotals, parseDiscount, parseQty, qtyWords, WHOLE_HOME, type ElectricalItem } from '@/modules/project/electrical-rules';
import { Combobox, type ComboOption } from '../../quotations/[id]/Combobox';
import { cancelElectricalAction, saveElectricalAction, sendElectricalAction } from './electrical-actions';
import '../../quotations/quotes.css';

type Data = { bills: ElectricalBillView[]; items: ElectricalItem[]; canWrite: boolean; open: string | null; gstBps: number; rooms: string[] };
type Row = { key: string; room: string; itemId: string; qty: string; note: string };
type Draft = { id?: string; rooms: string[]; rows: Row[]; discount: string };
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
const newRow = (room: string, itemId = ''): Row => ({ key: `r${++seq}`, room, itemId, qty: '', note: '' });

/**
 * The Electrical bill tab (owner, 22 Nov 2026): "similar to the quotation builder, with rooms, layout, total",
 * "so the items are segregated according to rooms". Rooms as dark bands (the quotation's rooms one click away),
 * each with its items from the electrical rate list (description, unit and rate come with the item), the
 * quantity and a note, and the room's sub-total; then work, discount (15% unless changed), GST and the total.
 * Save, then send to the client; once they approve it in the app it is spread over the unpaid payment stages
 * and joins the project value.
 */
export function ElectricalPanel({ projectId, data, customer }: { projectId: string; data: Data; customer: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
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
  const firstRoom = data.rooms[0] ?? WHOLE_HOME;
  return (
    <div className="flex flex-col gap-3">
      <section className="card flex flex-col gap-1">
        <h2 className="m-0 text-[15px] font-semibold">Electrical bill</h2>
        <p className="m-0 muted text-[13.5px]">
          Room by room, like the quotation: pick items from the{' '}
          <Link href="/studio/products/electrical" className="underline">
            electrical rate list
          </Link>{' '}
          and set the quantities. Send it to {customer}; once they approve it in the app, it is added to the project value and spread over the payment stages not yet paid.
        </p>
        {data.open ? (
          <p className="m-0 text-[13px]" style={{ color: 'var(--bad)' }}>
            {data.open}
          </p>
        ) : null}
        {data.items.length === 0 ? (
          <p className="m-0 text-[13px]" style={{ color: 'var(--bad)' }}>
            The electrical rate list is empty: the owner or the design head adds the items first.
          </p>
        ) : null}
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
          quoteRooms={data.rooms}
          initial={editing}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={(rows, discount) =>
            run(
              () => saveElectricalAction(projectId, { id: editing.id, lines: rows.map((r) => ({ room: r.room, itemId: r.itemId, qty: r.qty, note: r.note })), discount }),
              () => setEditing(null),
            )
          }
        />
      ) : data.canWrite && !data.open && data.items.length > 0 ? (
        <div>
          <button
            type="button"
            className="btn pri sm"
            onClick={() => setEditing({ rooms: [firstRoom], rows: [newRow(firstRoom)], discount: String(DEFAULT_DISCOUNT_BPS / 100) })}
          >
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
          <div className="flex flex-wrap gap-2">
            {/* Owner, 22 Nov 2026: "it should generate a PDF electrical bill". */}
            <Link href={`/studio/projects/${projectId}/electrical/${b.id}`} target="_blank" className="btn sec sm">
              Generate PDF
            </Link>
            {data.canWrite && b.status === 'DRAFT' ? (
              <>
                <button
                  type="button"
                  className="btn sec sm"
                  disabled={pending}
                  onClick={() => {
                    const rows = b.lines.map((l) => ({ key: `r${++seq}`, room: l.room, itemId: l.itemId ?? '', qty: String(l.qtyMilli / 1000), note: l.note ?? '' }));
                    setEditing({ id: b.id, discount: String(b.discountBps / 100), rooms: [...new Set(rows.map((r) => r.room))], rows });
                  }}
                >
                  Edit
                </button>
                <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => sendElectricalAction(projectId, b.id))}>
                  Send to {customer}
                </button>
              </>
            ) : null}
            {data.canWrite && (b.status === 'DRAFT' || b.status === 'SENT_TO_CLIENT') ? (
              <button type="button" className="btn ghost sm" disabled={pending} onClick={() => window.confirm('Cancel this electrical bill?') && run(() => cancelElectricalAction(projectId, b.id))}>
                Cancel
              </button>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

/** A saved bill, room by room, as the quotation shows its rooms. */
function BillTable({ bill }: { bill: ElectricalBillView }) {
  return (
    <div className="tscroll htable-wrap">
      <table className="htable" style={{ minWidth: 640 }}>
        <colgroup>
          <col style={{ width: 44 }} />
          <col />
          <col style={{ width: 120 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 120 }} />
        </colgroup>
        <tbody>
          {byRoom(bill.lines).map((g) => (
            <Fragment key={g.room}>
              <tr className="hband">
                <td colSpan={5}>{g.room}</td>
              </tr>
              <tr className="hhead">
                <th scope="col">#</th>
                <th scope="col">Item</th>
                <th scope="col">Quantity</th>
                <th scope="col" className="r">
                  Rate
                </th>
                <th scope="col" className="r">
                  Amount
                </th>
              </tr>
              {g.lines.map((l, i) => (
                <tr key={i}>
                  <td className="c">{i + 1}</td>
                  <td>
                    <b>{l.product}</b>
                    {l.details ? <span className="block muted">{l.details}</span> : null}
                    {l.note ? <span className="block" style={{ fontStyle: 'italic' }}>Note: {l.note}</span> : null}
                  </td>
                  <td>{qtyWords(l.qtyMilli, l.unitLabel)}</td>
                  <td className="r mono">{inr(l.ratePaise)}</td>
                  <td className="r mono">{inr(l.amountPaise)}</td>
                </tr>
              ))}
              <tr className="hsub">
                <td colSpan={4}>{g.room} — Sub-total</td>
                <td className="r mono">{inr(g.subPaise)}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      <Totals work={bill.workPaise} discountBps={bill.discountBps} discount={bill.discountPaise} gstBps={bill.gstBps} gst={bill.gstPaise} total={bill.totalPaise} />
    </div>
  );
}

/** The totals under the rooms, in the quotation's totals style. */
function Totals({ work, discountBps, discount, gstBps, gst, total, discountInput }: { work: number; discountBps: number; discount: number; gstBps: number; gst: number; total: number; discountInput?: React.ReactNode }) {
  return (
    <div className="htotals" style={{ marginLeft: 'auto', marginTop: 10 }}>
      <table className="htable htot">
        <tbody>
          <tr>
            <th scope="row">Work (all rooms)</th>
            <td className="mono">{inr(work)}</td>
          </tr>
          <tr className={discount ? 'neg' : 'off'}>
            <th scope="row">{discountInput ?? <>Discount ({discountBps / 100}%)</>}</th>
            <td className="mono">{discount ? `− ${inr(discount)}` : '—'}</td>
          </tr>
          {gstBps ? (
            <tr>
              <th scope="row">GST ({gstBps / 100}%)</th>
              <td className="mono">+ {inr(gst)}</td>
            </tr>
          ) : null}
          <tr className="hband">
            <th scope="row">Electrical total</th>
            <td className="mono">{inr(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Builder({
  items,
  gstBps,
  quoteRooms,
  initial,
  pending,
  onCancel,
  onSave,
}: {
  items: ElectricalItem[];
  gstBps: number;
  quoteRooms: string[];
  initial: Draft;
  pending: boolean;
  onCancel: () => void;
  onSave: (rows: Row[], discount: string) => void;
}) {
  const [rooms, setRooms] = useState<string[]>(initial.rooms);
  const [rows, setRows] = useState<Row[]>(initial.rows);
  const [discount, setDiscount] = useState(initial.discount);
  const [custom, setCustom] = useState('');
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const options: ComboOption[] = useMemo(() => items.map((i) => ({ value: i.id, label: i.name, hint: `${inr(i.ratePaise)}/${i.unit}` })), [items]);
  const set = (key: string, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Shown as it will be priced: the server prices again from the rate list.
  const amountOf = (r: Row) => {
    const item = byId.get(r.itemId);
    const q = parseQty(r.qty);
    return item && q !== null ? electricalAmount(item.ratePaise, q) : 0;
  };
  const discountBps = parseDiscount(discount);
  const t = electricalTotals(rows.map((r) => ({ amountPaise: amountOf(r) })), gstBps, discountBps ?? 0);

  const addRoom = (name: string) => {
    const room = name.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!room) return;
    if (!rooms.includes(room)) setRooms((list) => [...list, room]);
    setRows((list) => (list.some((r) => r.room === room) ? list : [...list, newRow(room)]));
    setCustom('');
  };
  const removeRoom = (room: string) => {
    const filled = rows.filter((r) => r.room === room && r.itemId).length;
    if (filled && !window.confirm(`Remove ${room} and its ${filled} ${filled === 1 ? 'item' : 'items'}?`)) return;
    setRooms((list) => list.filter((r) => r !== room));
    setRows((list) => list.filter((r) => r.room !== room));
  };
  const unused = [...quoteRooms, WHOLE_HOME].filter((r, i, all) => all.indexOf(r) === i && !rooms.includes(r));

  return (
    <form
      className="card flex flex-col gap-3"
      aria-label="Electrical bill"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(
          rows.filter((r) => r.itemId),
          discount,
        );
      }}
    >
      {/* Rooms: the quotation's own, one click each, or a new name. */}
      <div className="flex flex-col gap-2">
        <span className="hsec first">Rooms</span>
        <div className="flex flex-wrap items-center gap-2">
          {unused.map((r) => (
            <button key={r} type="button" className="btn sec sm" onClick={() => addRoom(r)}>
              + {r}
            </button>
          ))}
          <input className="fld" style={{ width: 180, minHeight: 34 }} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Another room…" aria-label="New room name" onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addRoom(custom);
            }
          }} />
          <button type="button" className="btn ghost sm" disabled={!custom.trim()} onClick={() => addRoom(custom)}>
            Add room
          </button>
        </div>
      </div>

      <div className="tscroll htable-wrap">
        <table className="htable" style={{ minWidth: 860 }}>
          <colgroup>
            <col style={{ width: 40 }} />
            <col style={{ width: 300 }} />
            <col />
            <col style={{ width: 120 }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 36 }} />
          </colgroup>
          <tbody>
            {rooms.map((room) => {
              const mine = rows.filter((r) => r.room === room);
              const sub = mine.reduce((a, r) => a + amountOf(r), 0);
              return (
                <Fragment key={room}>
                  <tr className="hband">
                    <td colSpan={6}>{room}</td>
                    <td className="c">
                      <button type="button" className="hx" style={{ color: 'inherit' }} onClick={() => removeRoom(room)} aria-label={`Remove ${room}`} title={`Remove ${room}`}>
                        ✕
                      </button>
                    </td>
                  </tr>
                  <tr className="hhead">
                    <th scope="col">#</th>
                    <th scope="col">Item</th>
                    <th scope="col">Details · note</th>
                    <th scope="col">Quantity</th>
                    <th scope="col" className="r">
                      Rate
                    </th>
                    <th scope="col" className="r">
                      Amount
                    </th>
                    <th scope="col">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                  {mine.map((r, i) => {
                    const item = byId.get(r.itemId);
                    const amount = amountOf(r);
                    return (
                      <tr key={r.key}>
                        <td className="c">{i + 1}</td>
                        <td>
                          <Combobox compact label={`${room} line ${i + 1} item`} value={r.itemId} options={options} placeholder="Search item…" emptyNote="Not on the electrical rate list." onChange={(v) => set(r.key, { itemId: v })} />
                        </td>
                        <td>
                          {item?.details ? <span className="block muted" style={{ marginBottom: 3 }}>{item.details}</span> : null}
                          <input className="hcell" value={r.note} maxLength={200} onChange={(e) => set(r.key, { note: e.target.value })} placeholder="Note: height, position…" aria-label={`${room} line ${i + 1} note`} />
                        </td>
                        <td>
                          <span className="hqty">
                            <input className="hcell num" inputMode="decimal" value={r.qty} onChange={(e) => set(r.key, { qty: e.target.value })} placeholder="0" aria-label={`${room} line ${i + 1} quantity`} />
                            <span className="hunit muted">{item?.unit ?? ''}</span>
                          </span>
                        </td>
                        <td className="r mono">{item ? inr(item.ratePaise) : '—'}</td>
                        <td className="r mono">{amount ? inr(amount) : '—'}</td>
                        <td className="c">
                          <button type="button" className="hx" onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))} aria-label={`Remove ${room} line ${i + 1}`} title="Remove line">
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="hsub">
                    <td colSpan={5}>
                      {room} — Sub-total
                      <button type="button" className="hmini" onClick={() => setRows((list) => [...list, newRow(room)])}>
                        + add item
                      </button>
                    </td>
                    <td className="r mono">{inr(sub)}</td>
                    <td />
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {rooms.length === 0 ? <p className="muted m-0 text-[13px]">Add a room above to start.</p> : null}

      <Totals
        work={t.workPaise}
        discountBps={discountBps ?? 0}
        discount={t.discountPaise}
        gstBps={gstBps}
        gst={t.gstPaise}
        total={t.totalPaise}
        discountInput={
          /* Owner, 22 Nov 2026: 15% off by default; change it, or 0 for none. */
          <label className="hdisc" style={{ justifyContent: 'flex-start' }}>
            Discount
            <input className="hcell num" style={{ width: 56 }} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} aria-label="Discount percent" />%
          </label>
        }
      />
      {discountBps === null ? (
        <p className="m-0 text-[13px]" style={{ color: 'var(--bad)' }}>
          The discount is a percent from 0 to 50, like 15.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn pri sm" disabled={pending || !rows.some((r) => r.itemId) || discountBps === null}>
          {pending ? 'Saving…' : 'Save draft'}
        </button>
        <button type="button" className="btn ghost sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
