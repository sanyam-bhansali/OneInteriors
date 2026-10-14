'use client';

/**
 * The Extra work tab (change orders, owner 15 Oct 2026): extra work after
 * design sign-off, from the product master (sized like the quotation
 * builder, at the studio's rate) or a custom line with an amount, a reason
 * and an optional photo or drawing. Draft → sent to the client → approved
 * (or declined, with their reason) → paid (accounts records it) → released
 * to the factory. Every figure is worked out by change-order-rules.ts, the
 * same rules the server prices with; the server re-prices from the product
 * master on save, so nothing typed here can change a rate.
 */

import { useMemo, useState, useTransition } from 'react';
import { formatINR } from '@/lib/money';
import { checkExtraLines, extraTotals, STATUS_LABEL, type ProductForExtra } from '@/modules/project/change-order-rules';
import { MODE_LABEL, PAYMENT_MODES } from '@/modules/project/payment-ledger';
import type { StudioExtra, StudioExtras } from '@/modules/project/change-orders';
import { UNIT_LABELS } from '@/modules/studio-quote/pricing';
import { cancelExtraAction, recordExtraPaymentAction, releaseExtraAction, saveExtraAction, sendExtraAction } from './extras-actions';

interface Row {
  productId: string;
  room: string;
  widthMm: string;
  heightMm: string;
  qty: string;
  description: string;
  amount: string;
  code: 'MODULAR' | 'ONSITE';
}

const blank = (): Row => ({ productId: '', room: '', widthMm: '', heightMm: '', qty: '', description: '', amount: '', code: 'ONSITE' });
const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`;
const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const tone: Record<StudioExtra['status'], string> = {
  DRAFT: '',
  SENT_TO_CLIENT: 'warn',
  APPROVED: 'oi',
  DECLINED: 'bad',
  PAID: 'good',
  RELEASED: 'ink',
  CANCELLED: '',
};

export function ExtrasPanel({ data, customer }: { data: StudioExtras; customer: string }) {
  const [editing, setEditing] = useState<StudioExtra | 'new' | null>(null);
  const toRelease = data.extras.filter((e) => e.status === 'PAID').length;
  const withClient = data.extras.filter((e) => e.status === 'SENT_TO_CLIENT').length;
  return (
    <section aria-label="Extra work" className="card flex flex-col gap-4 p-5" data-testid="extras-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[17px]">Extra work after sign-off</h2>
          <span className="muted sm">
            {customer} approves each one in the app, then pays; release it to the factory once paid. It is added to the quotation as extras, never changing the signed lines
            {data.quote.number ? ` (quotation ${data.quote.number}: modular discount ${pct(data.quote.discountBps)}, GST ${pct(data.quote.gstBps)})` : ''}.
          </span>
        </div>
        <span className="flex flex-wrap gap-2">
          {withClient ? <span className="chip warn">{withClient} with {customer}</span> : null}
          {toRelease ? <span className="chip good">{toRelease} ready to release</span> : null}
          <span className="chip mono" title="Approved, paid and released extra work, GST included">
            Extras after sign-off {formatINR(data.approvedPaise)}
          </span>
        </span>
      </div>

      {data.noPlan ? <p className="m-0 muted">This project was not signed in the app, so there is no payment plan for extra work to land on.</p> : null}
      {!data.open.ok ? <p className="m-0 muted">{data.open.error}</p> : null}
      {data.canWrite && data.open.ok && !data.noPlan && editing === null ? (
        <div>
          <button type="button" className="btn pri" onClick={() => setEditing('new')} data-testid="extra-add">
            Add extra work
          </button>
        </div>
      ) : null}
      {editing !== null ? <ExtraEditor data={data} extra={editing === 'new' ? null : editing} onDone={() => setEditing(null)} /> : null}

      {data.extras.length === 0 ? (
        <div className="empty">
          <b>No extra work yet.</b>
          <span className="muted">A loft, an extra shutter, a change on site: add it here so it is approved and paid before it is made.</span>
        </div>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {data.extras.map((e) => (
            <ExtraCard key={e.id} e={e} data={data} customer={customer} onEdit={() => setEditing(e)} />
          ))}
        </ol>
      )}
    </section>
  );
}

function ExtraEditor({ data, extra, onDone }: { data: StudioExtras; extra: StudioExtra | null; onDone: () => void }) {
  const [title, setTitle] = useState(extra?.title ?? '');
  const [reason, setReason] = useState(extra?.reason ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    extra?.draftLines.length
      ? extra.draftLines.map((l) => ({
          productId: l.productId ?? '',
          room: l.room ?? '',
          widthMm: l.widthMm ? String(l.widthMm) : '',
          heightMm: l.heightMm ? String(l.heightMm) : '',
          qty: l.qty ?? '',
          description: l.productId ? '' : l.description,
          amount: l.amount ?? '',
          code: l.code,
        }))
      : [blank()],
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const products = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);
  const raw = rows.map((r) =>
    r.productId ? { productId: r.productId, room: r.room, widthMm: r.widthMm, heightMm: r.heightMm, qty: r.qty } : { description: r.description, amount: r.amount, code: r.code, room: r.room },
  );
  const checked = checkExtraLines(raw, products);
  const totals = checked.ok ? extraTotals(checked.lines, data.quote) : null;
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const save = () => {
    setMsg(null);
    const form = new FormData();
    form.set('projectId', data.projectId);
    if (extra) form.set('id', extra.id);
    form.set('title', title);
    form.set('reason', reason);
    form.set('lines', JSON.stringify(raw));
    if (photo) form.set('photo', photo);
    start(async () => {
      const r = await saveExtraAction(form);
      if (r.ok) onDone();
      else setMsg({ ok: false, text: r.error });
    });
  };

  return (
    <div className="card flex flex-col gap-3 p-4" style={{ background: 'var(--fill)' }} data-testid="extra-editor">
      <label className="fld">
        <span className="lbl">What is it (the client reads this)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Loft in bedroom 2" data-testid="extra-title" />
      </label>
      <label className="fld">
        <span className="lbl">Why (the client reads this)</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={600} rows={2} placeholder="Asked for on the site visit of 14 Oct: storage above the wardrobe." />
      </label>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => {
          const p: ProductForExtra | undefined = r.productId ? products.get(r.productId) : undefined;
          return (
            <div key={i} className="flex flex-wrap items-end gap-2" data-testid="extra-line">
              <label className="fld" style={{ minWidth: 220, flex: '2 1 220px' }}>
                <span className="lbl">From the product master, or custom</span>
                <select value={r.productId} onChange={(e) => set(i, { productId: e.target.value })} data-testid="extra-product">
                  <option value="">Custom line (amount)</option>
                  {data.products.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} · {UNIT_LABELS[x.unit]} · {formatINR(x.ratePaise)}
                      {x.unit === 'UNIT' ? ' each' : x.unit === 'RFT' ? '/rft' : '/sq ft'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fld" style={{ flex: '1 1 120px' }}>
                <span className="lbl">Room</span>
                <input value={r.room} onChange={(e) => set(i, { room: e.target.value })} maxLength={80} placeholder="Bedroom 2" />
              </label>
              {p ? (
                p.unit === 'AREA' ? (
                  <>
                    <label className="fld" style={{ width: 110 }}>
                      <span className="lbl">Width mm</span>
                      <input inputMode="numeric" value={r.widthMm} onChange={(e) => set(i, { widthMm: e.target.value.replace(/\D/g, '') })} data-testid="extra-width" />
                    </label>
                    <label className="fld" style={{ width: 110 }}>
                      <span className="lbl">Height mm</span>
                      <input inputMode="numeric" value={r.heightMm} onChange={(e) => set(i, { heightMm: e.target.value.replace(/\D/g, '') })} data-testid="extra-height" />
                    </label>
                  </>
                ) : (
                  <label className="fld" style={{ width: 120 }}>
                    <span className="lbl">{p.unit === 'SQFT' ? 'Sq ft' : p.unit === 'RFT' ? 'Running ft' : 'Quantity'}</span>
                    <input inputMode="decimal" value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} data-testid="extra-qty" />
                  </label>
                )
              ) : (
                <>
                  <label className="fld" style={{ flex: '2 1 200px' }}>
                    <span className="lbl">Description</span>
                    <input value={r.description} onChange={(e) => set(i, { description: e.target.value })} maxLength={200} data-testid="extra-description" />
                  </label>
                  <label className="fld" style={{ width: 130 }}>
                    <span className="lbl">Amount ₹ (before GST)</span>
                    <input inputMode="decimal" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} data-testid="extra-amount" />
                  </label>
                  <label className="fld" style={{ width: 120 }}>
                    <span className="lbl">Work</span>
                    <select value={r.code} onChange={(e) => set(i, { code: e.target.value === 'MODULAR' ? 'MODULAR' : 'ONSITE' })}>
                      <option value="ONSITE">On-site</option>
                      <option value="MODULAR">Modular</option>
                    </select>
                  </label>
                </>
              )}
              <button type="button" className="btn ghost sm" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, k) => k !== i) : [blank()]))} aria-label={`Remove line ${i + 1}`}>
                ×
              </button>
            </div>
          );
        })}
        <div>
          <button type="button" className="btn sec sm" onClick={() => setRows((rs) => [...rs, blank()])}>
            Add a line
          </button>
        </div>
      </div>
      <label className="fld">
        <span className="lbl">Photo or drawing (optional; the client sees it once sent)</span>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </label>
      <div className="tscroll">
        <table className="tbl" aria-label="Price of the extra work">
          <tbody>
            {checked.ok
              ? checked.lines.map((l, i) => (
                  <tr key={i}>
                    <td>
                      {l.product}
                      {l.room ? ` · ${l.room}` : ''}
                    </td>
                    <td className="mono text-right">{formatINR(l.amountPaise)}</td>
                  </tr>
                ))
              : null}
            {totals && totals.discountPaise > 0 ? (
              <tr>
                <td>Modular discount ({pct(data.quote.discountBps)}, as the quotation)</td>
                <td className="mono text-right">− {formatINR(totals.discountPaise)}</td>
              </tr>
            ) : null}
            {totals ? (
              <tr>
                <td>GST ({pct(data.quote.gstBps)}, as the quotation)</td>
                <td className="mono text-right">{formatINR(totals.gstPaise)}</td>
              </tr>
            ) : null}
            <tr>
              <td>
                <b>The client pays</b>
              </td>
              <td className="mono text-right">
                <b>{totals ? formatINR(totals.totalPaise) : '—'}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {!checked.ok ? <p className="m-0 muted sm">{checked.error}</p> : null}
      {msg ? (
        <p className={`m-0 sm ${msg.ok ? 'good-t' : 'bad-t'}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn pri" disabled={pending || !checked.ok || title.trim().length < 2} onClick={save} data-testid="extra-save">
          {pending ? 'Saving…' : 'Save as draft'}
        </button>
        <button type="button" className="btn ghost" onClick={onDone} disabled={pending}>
          Close
        </button>
      </div>
    </div>
  );
}

function ExtraCard({ e, data, customer, onEdit }: { e: StudioExtra; data: StudioExtras; customer: string; onEdit: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [paying, setPaying] = useState(false);
  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? 'Done.' } : { ok: false, text: r.error });
    });
  };
  const ready = e.status === 'PAID' && e.paid.covered && !e.paid.disputed;
  return (
    <li className="card flex flex-col gap-2 p-4" data-testid="extra-card" data-status={e.status}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <b>
          Extra work {e.number}: {e.title}
        </b>
        <span className="flex flex-wrap items-center gap-2">
          <span className={`chip ${tone[e.status]}`}>{ready ? 'Paid · ready to release' : STATUS_LABEL[e.status]}</span>
          <b className="mono">{formatINR(e.totalPaise)}</b>
        </span>
      </div>
      {e.reason ? <span className="sm">Why: {e.reason}</span> : null}
      <div className="tscroll">
        <table className="tbl" aria-label={`Extra work ${e.number}`}>
          <tbody>
            {e.lines.map((l, i) => (
              <tr key={i}>
                <td>
                  {l.product}
                  {l.room ? ` · ${l.room}` : ''}
                  {l.size ? <span className="muted"> · {l.size}</span> : null}
                  {l.fromMaster ? <span className="muted sm"> · {formatINR(l.ratePaise)} rate</span> : null}
                </td>
                <td className="mono text-right">{formatINR(l.amountPaise)}</td>
              </tr>
            ))}
            {e.discountPaise > 0 ? (
              <tr>
                <td>Modular discount ({pct(e.discountBps)})</td>
                <td className="mono text-right">− {formatINR(e.discountPaise)}</td>
              </tr>
            ) : null}
            <tr>
              <td>GST ({pct(e.gstBps)})</td>
              <td className="mono text-right">{formatINR(e.gstPaise)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {e.photoUrl ? (
        <a href={e.photoUrl} target="_blank" rel="noreferrer" className="sm acc-t">
          Photo / drawing
        </a>
      ) : null}
      {e.status === 'DECLINED' && e.declineReason ? (
        <span className="sm bad-t">
          {customer} declined: “{e.declineReason}”
        </span>
      ) : null}
      {['APPROVED', 'PAID', 'RELEASED'].includes(e.status) ? (
        <span className="sm">
          Recorded {formatINR(e.paid.recordedPaise)} of {formatINR(e.totalPaise)}
          {e.paid.waiting ? ` · waiting for ${customer} to confirm` : ''}
          {e.paid.disputed ? ` · ${customer} says a payment was not made; One Interiors is looking into it` : ''}
          {e.status === 'PAID' && !e.paid.covered ? ' · a correction took the payment below the price: check it before releasing' : ''}
        </span>
      ) : null}
      <span className="muted sm">{e.history.map((h) => `${h.on} ${h.by}: ${STATUS_LABEL[h.to as StudioExtra['status']] ?? h.to}${h.text ? ` (“${h.text}”)` : ''}`).join(' · ')}</span>

      <div className="flex flex-wrap gap-2">
        {data.canWrite && e.status === 'DRAFT' ? (
          <>
            <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => sendExtraAction(data.projectId, e.id), `Send extra work ${e.number} (${formatINR(e.totalPaise)}) to ${customer} to approve?`)} data-testid="extra-send">
              Send to {customer}
            </button>
            <button type="button" className="btn sec sm" disabled={pending} onClick={onEdit}>
              Edit
            </button>
          </>
        ) : null}
        {data.canWrite && (e.status === 'DRAFT' || e.status === 'SENT_TO_CLIENT') ? (
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => cancelExtraAction(data.projectId, e.id), e.status === 'SENT_TO_CLIENT' ? `Take back extra work ${e.number}? ${customer} will no longer see it to approve.` : undefined)}>
            {e.status === 'DRAFT' ? 'Cancel draft' : 'Take it back'}
          </button>
        ) : null}
        {data.canRecord && (e.status === 'APPROVED' || (e.status === 'PAID' && !e.paid.covered)) && !paying ? (
          <button type="button" className="btn pri sm" disabled={pending} onClick={() => setPaying(true)} data-testid="extra-record">
            Record payment
          </button>
        ) : null}
        {data.canWrite && e.status === 'PAID' ? (
          <button
            type="button"
            className="btn acc sm"
            disabled={pending || !ready}
            onClick={() => run(() => releaseExtraAction(data.projectId, e.id), `Release extra work ${e.number} to the factory / the work?`)}
            data-testid="extra-release"
          >
            Release to factory
          </button>
        ) : null}
      </div>
      {paying ? <RecordExtraPayment projectId={data.projectId} e={e} onDone={() => setPaying(false)} /> : null}
      {msg ? (
        <p className={`m-0 sm ${msg.ok ? 'good-t' : 'bad-t'}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      ) : null}
    </li>
  );
}

export function RecordExtraPayment({ projectId, e, onDone }: { projectId: string; e: { id: string; paid: { openPaise: number } }; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(ev) => {
        ev.preventDefault();
        const form = new FormData(ev.currentTarget);
        form.set('projectId', projectId);
        form.set('extraId', e.id);
        setError(null);
        start(async () => {
          const r = await recordExtraPaymentAction(form);
          if (r.ok) onDone();
          else setError(r.error);
        });
      }}
      data-testid="extra-payment-form"
    >
      <label className="fld" style={{ width: 140 }}>
        <span className="lbl">Amount ₹</span>
        <input name="amount" inputMode="decimal" defaultValue={String(e.paid.openPaise / 100)} required />
      </label>
      <label className="fld" style={{ width: 150 }}>
        <span className="lbl">Received on</span>
        <input name="receivedOn" type="date" defaultValue={today()} max={today()} required />
      </label>
      <label className="fld" style={{ width: 150 }}>
        <span className="lbl">How</span>
        <select name="mode" defaultValue="UPI">
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <label className="fld" style={{ flex: '1 1 160px' }}>
        <span className="lbl">Note (only your team: UTR, cheque no.)</span>
        <input name="note" maxLength={300} />
      </label>
      <label className="fld" style={{ flex: '1 1 160px' }}>
        <span className="lbl">Receipt (optional)</span>
        <input name="receipt" type="file" accept="image/*,application/pdf" />
      </label>
      <button type="submit" className="btn pri sm" disabled={pending}>
        {pending ? 'Recording…' : 'Record'}
      </button>
      <button type="button" className="btn ghost sm" onClick={onDone} disabled={pending}>
        Close
      </button>
      {error ? (
        <p className="m-0 w-full sm bad-t" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
