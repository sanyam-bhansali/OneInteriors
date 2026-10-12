'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { dayWords, muted, rupees } from './format';
import { quickAmounts, qtyWords, TOLERANCE_PAISE } from '@/modules/studio-crews/money';
import { STATUS_LABEL, statementWhatsApp, type LineView, type WorkOrderStatusName, type WorkOrderView } from '@/modules/studio-crews/rules';
import { CREW_UNIT_LABEL, CREW_UNIT_SHORT, CREW_UNITS, type CrewUnitName } from '@/modules/studio-crews/trades';
import {
  addExtraAction,
  archiveOrderAction,
  correctCrewPaymentAction,
  editOrderAction,
  recordCrewPaymentAction,
  removeLineAction,
  removeOrderAction,
  setLineCarpentryAction,
  setLinePriceAction,
  setLineQtyAction,
  setOrderStatusAction,
  swapCrewAction,
} from './actions';

/**
 * The pieces every crew screen shares (Studio OS Phase 3): one work order
 * with its lines, quantities, extras, status and — for owner and accounts
 * only — rates, amounts and payments. The server has already taken the
 * money out of what a PM receives (studio-crews/rules.ts `stripMoney`), so
 * this component never has a figure to hide; it simply draws what it got.
 */

type Result = { ok: true; message: string } | { ok: false; error: string };

const cell = 'border-t border-[var(--s-rule)] px-2 py-2 align-top';
const num = 's-num font-[family-name:var(--font-mono)]';

export function useRun() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) after?.();
    });
  return { pending, message, run, setMessage };
}

export function Message({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return (
    <p role={m.ok ? 'status' : 'alert'} className={`m-0 text-[12.5px] ${m.ok ? 'text-[var(--s-good)]' : 'text-[var(--s-bad)]'}`}>
      {m.text}
    </p>
  );
}

const TONE: Record<WorkOrderStatusName, string> = {
  DRAFT: 'var(--s-ink-3)',
  ISSUED: 'var(--s-accent)',
  IN_PROGRESS: 'var(--s-accent)',
  WORK_DONE: 'var(--s-warn)',
  SETTLED: 'var(--s-good)',
};

export function StatusPill({ status, archived }: { status: WorkOrderStatusName; archived?: boolean }) {
  if (archived) return <span className="s-tag">Archived</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: TONE[status] }}>
      <span className="s-dot" style={{ background: TONE[status] }} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

const unitShort = (u: CrewUnitName) => CREW_UNIT_SHORT[u];

/** Rupees as typed in a field: "1500" for 150000 paise. */
const asRupees = (paise: number | null) => (paise === null ? '' : String(paise / 100));

export interface CardProps {
  order: WorkOrderView;
  projectId: string;
  canBuild: boolean;
  seesMoney: boolean;
  canPay: boolean;
  allCrews?: { id: string; name: string; trades: string[] }[];
  steps?: { id: string; label: string; stage: string; done: boolean }[];
  advanceLimitPaise?: number;
  payee?: { upiId: string | null; bankAccountName: string | null; bankAccountMasked: string | null; bankIfsc: string | null } | null;
  open?: boolean;
  /** Show the project's name (crew and overview pages) rather than the crew's. */
  showProject?: boolean;
}

/** One work order. Collapsed to a summary row; opens to its lines and actions. */
export function WorkOrderCard(p: CardProps) {
  const o = p.order;
  const [open, setOpen] = useState(p.open ?? false);
  const m = o.money;
  return (
    <li className="s-card list-none overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full flex-wrap items-center justify-between gap-3 bg-transparent px-4 py-3 text-left">
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold">
            WO-{o.number} · {p.showProject ? o.projectName : o.crewName}
          </span>
          <span className={muted}>
            {p.showProject ? `${o.crewName} · ` : ''}
            {o.trades.map((t) => t.label).join(', ') || 'No trade'} · {o.lines.length} line{o.lines.length === 1 ? '' : 's'}
            {o.needPrice ? ` · ${o.needPrice} to price` : ''}
            {o.needQty ? ` · ${o.needQty} need a quantity` : ''}
            {o.dueOn ? ` · due ${dayWords(o.dueOn)}` : ''}
          </span>
        </span>
        <span className="flex items-center gap-4">
          {m ? (
            <span className={`${num} text-[13.5px]`}>
              {rupees(m.billPaise)} billed · <strong>{rupees(m.balancePaise)}</strong> to pay
            </span>
          ) : null}
          <StatusPill status={o.status} archived={o.archived} />
          <span aria-hidden="true" className="text-[var(--s-ink-3)]">
            {open ? '▴' : '▾'}
          </span>
        </span>
      </button>
      {open ? <OrderBody {...p} /> : null}
    </li>
  );
}

function OrderBody(p: CardProps) {
  const o = p.order;
  const m = o.money;
  const r = useRun();
  const closed = o.archived || o.status === 'SETTLED';
  const editable = p.canBuild && !closed;
  const rooms = [...new Set(o.lines.map((l) => l.room))];
  return (
    <div className="flex flex-col gap-4 border-t border-[var(--s-rule)] px-4 py-4">
      {m ? <MoneyStrip order={o} /> : <p className={`m-0 ${muted}`}>Quantities only: rates, amounts and payments are kept by the owner and accounts.</p>}
      {m && m.variancePaise > TOLERANCE_PAISE ? (
        <p className="m-0 rounded-[9px] bg-[var(--s-warn-wash)] px-3 py-2 text-[13px] text-[var(--s-warn)]">
          {rupees(m.variancePaise)} above the quotation&apos;s quantities (site measurement and extras). Check it before the next payment.
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left">
              <th className="s-label px-2 py-1.5 font-normal">Line</th>
              <th className="s-label px-2 py-1.5 font-normal">Crew item</th>
              <th className="s-label px-2 py-1.5 text-right font-normal">Quoted</th>
              <th className="s-label px-2 py-1.5 font-normal">Measured</th>
              {m ? <th className="s-label px-2 py-1.5 font-normal">Rate</th> : null}
              {m ? <th className="s-label px-2 py-1.5 font-normal">Agreed</th> : null}
              {m ? <th className="s-label px-2 py-1.5 text-right font-normal">Amount</th> : null}
              {editable ? <th className="px-2 py-1.5" /> : null}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <RoomRows key={room} room={room} lines={o.lines.filter((l) => l.room === room)} p={p} editable={editable} run={r.run} pending={r.pending} />
            ))}
          </tbody>
        </table>
      </div>
      {o.lines.length === 0 ? <p className={`m-0 ${muted}`}>No lines on it yet.</p> : null}
      <Message m={r.message} />

      {editable || (p.seesMoney && !closed) ? <ExtraForm p={p} /> : null}

      {p.canBuild ? <OrderSettings p={p} /> : null}

      <StatusActions p={p} />

      {m && o.payments ? <Payments p={p} /> : null}
    </div>
  );
}

function MoneyStrip({ order: o }: { order: WorkOrderView }) {
  const m = o.money!;
  const fig = (label: string, value: string, note?: string) => (
    <div className="flex min-w-[120px] flex-col gap-0.5">
      <span className="s-label">{label}</span>
      <span className={`${num} text-[15.5px] font-semibold`}>{value}</span>
      {note ? <span className={muted}>{note}</span> : null}
    </div>
  );
  return (
    <div className="flex flex-wrap gap-x-7 gap-y-3">
      {fig('Billed', rupees(m.billPaise), o.needPrice + o.needQty ? `+${o.needPrice + o.needQty} to price` : `client value ${rupees(m.clientValuePaise)}`)}
      {fig('Paid', rupees(m.paidPaise))}
      {fig(m.balancePaise < -TOLERANCE_PAISE ? 'Advance out' : 'Balance', rupees(Math.abs(m.balancePaise)), m.balancePaise < -TOLERANCE_PAISE ? 'recovered as work is priced' : undefined)}
      {m.extrasPaise > 0 ? fig('Extras', rupees(m.extrasPaise), 'not in the quotation') : null}
    </div>
  );
}

function RoomRows({ room, lines, p, editable, run, pending }: { room: string; lines: LineView[]; p: CardProps; editable: boolean; run: ReturnType<typeof useRun>['run']; pending: boolean }) {
  const m = p.order.money;
  const cols = 4 + (m ? 3 : 0) + (editable ? 1 : 0);
  return (
    <>
      <tr>
        <td colSpan={cols} className="px-2 pb-1 pt-3 text-[12.5px] font-semibold text-[var(--s-ink-2)]">
          {room}
        </td>
      </tr>
      {lines.map((l) => (
        <LineRow key={l.id} l={l} p={p} editable={editable} run={run} pending={pending} />
      ))}
    </>
  );
}

function LineRow({ l, p, editable, run, pending }: { l: LineView; p: CardProps; editable: boolean; run: ReturnType<typeof useRun>['run']; pending: boolean }) {
  const m = p.order.money;
  const pid = p.projectId;
  const money = p.seesMoney && !p.order.archived && p.order.status !== 'SETTLED';
  const [sure, setSure] = useState(false);
  return (
    <tr>
      <td className={cell}>
        <span className="font-medium">{l.product}</span>
        <span className="mt-0.5 flex flex-wrap gap-1.5">
          {l.isExtra ? <span className="s-tag">Extra</span> : null}
          {l.guessed ? <span className="s-tag" title="The routing only guessed this trade. Fix it under Settings, Crews and trades.">Trade guessed</span> : null}
          {l.rateEdited ? <span className="s-tag">Rate edited</span> : null}
          {l.widthMm && l.heightMm ? <span className={muted}>{l.widthMm} × {l.heightMm} mm</span> : null}
        </span>
        {l.carpentry && !l.isExtra ? (
          <span className="mt-1 flex gap-1">
            {(['INSTALL', 'FULL'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={!(editable || money) || pending || l.carpentry === mode}
                onClick={() => run(() => setLineCarpentryAction(pid, l.id, mode))}
                className={`rounded-[6px] border px-1.5 py-0.5 text-[11.5px] ${l.carpentry === mode ? 'border-[var(--s-accent)] bg-[var(--s-accent-wash)] text-[var(--s-accent)]' : 'border-[var(--s-rule)] text-[var(--s-ink-3)]'}`}
              >
                {mode === 'INSTALL' ? 'Installation only' : 'Full carpentry'}
              </button>
            ))}
          </span>
        ) : null}
      </td>
      <td className={cell}>
        {l.item}
        <span className={`block ${muted}`}>
          per {CREW_UNIT_LABEL[l.unit]} · {l.tradeLabel}
        </span>
        {l.pending === 'price' ? <span className="s-tag mt-1" style={{ background: 'var(--s-warn-wash)', color: 'var(--s-warn)' }}>Needs a price</span> : null}
        {l.pending === 'qty' ? <span className="s-tag mt-1" style={{ background: 'var(--s-warn-wash)', color: 'var(--s-warn)' }}>Needs a quantity</span> : null}
      </td>
      <td className={`${cell} ${num} text-right`}>
        {l.qtyMilli === null ? (
          editable || money ? (
            <QtyInput label={`Quantity for ${l.product}`} placeholder="Estimate" onSave={(v) => run(() => setLineQtyAction(pid, l.id, { estimate: v }))} disabled={pending} />
          ) : (
            '—'
          )
        ) : (
          <>
            {qtyWords(l.qtyMilli)} <span className={muted}>{unitShort(l.unit)}</span>
          </>
        )}
      </td>
      <td className={cell}>
        {editable || money ? (
          <QtyInput
            label={`Measured quantity for ${l.product}`}
            initial={l.measuredQtyMilli === null ? '' : qtyWords(l.measuredQtyMilli)}
            placeholder="Measured"
            onSave={(v) => run(() => setLineQtyAction(pid, l.id, { measured: v }))}
            disabled={pending}
            warn={l.overQuote}
          />
        ) : (
          <span className={num}>{l.measuredQtyMilli === null ? '—' : qtyWords(l.measuredQtyMilli)}</span>
        )}
        {l.overQuote ? <span className="block text-[11.5px] text-[var(--s-warn)]">More than quoted</span> : null}
      </td>
      {m ? (
        <td className={cell}>
          {money ? (
            <MoneyInput label={`Rate for ${l.product}`} initial={asRupees(l.ratePaise)} placeholder="Rate" onSave={(v) => run(() => setLinePriceAction(pid, l.id, { rateRupees: v }))} disabled={pending} suffix={`/${unitShort(l.unit)}`} />
          ) : (
            <span className={num}>{l.ratePaise === null ? '—' : `${rupees(l.ratePaise)}/${unitShort(l.unit)}`}</span>
          )}
        </td>
      ) : null}
      {m ? (
        <td className={cell}>
          {money ? (
            <MoneyInput label={`Agreed amount for ${l.product}`} initial={asRupees(l.agreedPaise)} placeholder="Agreed ₹" onSave={(v) => run(() => setLinePriceAction(pid, l.id, { agreedRupees: v }))} disabled={pending} />
          ) : (
            <span className={num}>{l.agreedPaise === null ? '—' : rupees(l.agreedPaise)}</span>
          )}
        </td>
      ) : null}
      {m ? <td className={`${cell} ${num} text-right font-medium`}>{l.pending ? <span className={muted}>to price</span> : rupees(l.amountPaise)}</td> : null}
      {editable ? (
        <td className={`${cell} text-right`}>
          <button
            type="button"
            className="text-[12px] text-[var(--s-ink-3)] hover:text-[var(--s-bad)]"
            disabled={pending}
            onClick={() => {
              if (!sure) {
                setSure(true);
                setTimeout(() => setSure(false), 4000);
                return;
              }
              run(() => removeLineAction(pid, l.id));
            }}
          >
            {sure ? 'Sure?' : 'Remove'}
          </button>
        </td>
      ) : null}
    </tr>
  );
}

function QtyInput({ label, initial = '', placeholder, onSave, disabled, warn }: { label: string; initial?: string; placeholder: string; onSave: (v: string) => void; disabled: boolean; warn?: boolean }) {
  const [v, setV] = useState(initial);
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      className="s-input s-num w-[88px] px-2 py-1 text-right"
      style={warn ? { borderColor: 'var(--s-warn)' } : undefined}
      value={v}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== initial && onSave(v)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

function MoneyInput({ label, initial, placeholder, onSave, disabled, suffix }: { label: string; initial: string; placeholder: string; onSave: (v: string) => void; disabled: boolean; suffix?: string }) {
  const [v, setV] = useState(initial);
  return (
    <span className="inline-flex items-center gap-1">
      <span className={muted}>₹</span>
      <input
        aria-label={label}
        inputMode="decimal"
        className="s-input s-num w-[84px] px-2 py-1 text-right"
        value={v}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== initial && onSave(v)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {suffix ? <span className={muted}>{suffix}</span> : null}
    </span>
  );
}

function ExtraForm({ p }: { p: CardProps }) {
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState('');
  const [room, setRoom] = useState('');
  const [unit, setUnit] = useState<CrewUnitName>('SQFT');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [agreed, setAgreed] = useState('');
  const r = useRun();
  if (!open)
    return (
      <div>
        <button type="button" className="s-btn-ghost" onClick={() => setOpen(true)}>
          Add extra work
        </button>
      </div>
    );
  return (
    <form
      className="flex flex-col gap-2 rounded-[10px] bg-[var(--s-surface-2)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        r.run(() => addExtraAction(p.projectId, p.order.id, { what, room, unit, qty, rateRupees: rate, agreedRupees: agreed }), () => {
          setWhat('');
          setQty('');
          setRate('');
          setAgreed('');
          setOpen(false);
        });
      }}
    >
      <p className="m-0 text-[13.5px] font-semibold">Extra work, outside the quotation</p>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
        <input className="s-input" aria-label="What was done" placeholder="What was done" value={what} onChange={(e) => setWhat(e.target.value)} required />
        <input className="s-input" aria-label="Room" placeholder="Room (optional)" value={room} onChange={(e) => setRoom(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="s-input w-auto" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as CrewUnitName)}>
          {CREW_UNITS.map((u) => (
            <option key={u} value={u}>
              {CREW_UNIT_LABEL[u]}
            </option>
          ))}
        </select>
        {unit !== 'LUMP' ? <input className="s-input w-[110px]" aria-label="Quantity" inputMode="decimal" placeholder="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} /> : null}
        {p.seesMoney && unit !== 'LUMP' ? <input className="s-input w-[120px]" aria-label="Rate in rupees" inputMode="decimal" placeholder="Rate ₹" value={rate} onChange={(e) => setRate(e.target.value)} /> : null}
        {p.seesMoney ? <input className="s-input w-[130px]" aria-label="Agreed amount in rupees" inputMode="decimal" placeholder="Or agreed ₹" value={agreed} onChange={(e) => setAgreed(e.target.value)} /> : null}
      </div>
      {!p.seesMoney ? <p className={`m-0 ${muted}`}>Owner or accounts put the price on it.</p> : null}
      <div className="flex gap-2">
        <button type="submit" className="s-btn" disabled={r.pending}>
          Add it
        </button>
        <button type="button" className="s-btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <Message m={r.message} />
    </form>
  );
}

function OrderSettings({ p }: { p: CardProps }) {
  const o = p.order;
  const r = useRun();
  const [due, setDue] = useState(o.dueOn ?? '');
  const [steps, setSteps] = useState<string[]>(o.stepIds);
  const [swapTo, setSwapTo] = useState('');
  const [showSteps, setShowSteps] = useState(false);
  const closed = o.archived || o.status === 'SETTLED';
  const others = (p.allCrews ?? []).filter((c) => c.id !== o.vendorId);
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-[var(--s-rule)] p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="s-label">Pay by</span>
          <input type="date" className="s-input w-auto" value={due} onChange={(e) => setDue(e.target.value)} disabled={closed} />
        </label>
        <button type="button" className="s-btn-ghost" disabled={r.pending || closed || due === (o.dueOn ?? '')} onClick={() => r.run(() => editOrderAction(p.projectId, o.id, { dueOn: due }))}>
          Save date
        </button>
        {o.paymentCount === 0 && others.length > 0 && !closed ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="s-label">Give it to another crew</span>
              <select className="s-input w-auto" value={swapTo} onChange={(e) => setSwapTo(e.target.value)}>
                <option value="">Pick a crew</option>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="s-btn-ghost" disabled={!swapTo || r.pending} onClick={() => r.run(() => swapCrewAction(p.projectId, o.id, swapTo))}>
              Change crew
            </button>
          </>
        ) : null}
      </div>
      {p.steps && p.steps.length ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[13px]">
            <span className="font-medium">Linked tracker steps:</span>{' '}
            {o.steps.length ? o.steps.map((s) => `${s.done ? '✓ ' : ''}${s.label}`).join(' · ') : <span className={muted}>none yet</span>}{' '}
            <button type="button" className="text-[12.5px] text-[var(--s-accent)]" onClick={() => setShowSteps(!showSteps)}>
              {showSteps ? 'Close' : 'Change'}
            </button>
          </p>
          {showSteps ? (
            <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto rounded-[9px] bg-[var(--s-surface-2)] p-2">
              {p.steps.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={steps.includes(s.id)} onChange={(e) => setSteps(e.target.checked ? [...steps, s.id] : steps.filter((x) => x !== s.id))} />
                  <span className={s.done ? 'text-[var(--s-ink-3)]' : undefined}>
                    {s.label} <span className={muted}>· {s.stage}</span>
                  </span>
                </label>
              ))}
              <div>
                <button type="button" className="s-btn mt-1" disabled={r.pending} onClick={() => r.run(() => editOrderAction(p.projectId, o.id, { stepIds: steps }), () => setShowSteps(false))}>
                  Save steps
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <Message m={r.message} />
    </div>
  );
}

function StatusActions({ p }: { p: CardProps }) {
  const o = p.order;
  const r = useRun();
  const go = (to: WorkOrderStatusName) => r.run(() => setOrderStatusAction(p.projectId, o.id, to));
  const btns: { label: string; to: WorkOrderStatusName; loud?: boolean }[] = [];
  if (!o.archived) {
    if (p.canBuild) {
      if (o.status === 'DRAFT') btns.push({ label: 'Issue to the crew', to: 'ISSUED', loud: true });
      if (o.status === 'ISSUED') btns.push({ label: 'Work started', to: 'IN_PROGRESS', loud: true });
      if (o.status === 'ISSUED' || o.status === 'IN_PROGRESS') btns.push({ label: 'Mark work done', to: 'WORK_DONE', loud: o.status === 'IN_PROGRESS' });
      if (o.status === 'WORK_DONE') btns.push({ label: 'Reopen the work', to: 'IN_PROGRESS' });
    }
    if (p.seesMoney && o.money?.settled && o.status !== 'SETTLED' && o.status !== 'DRAFT') btns.push({ label: 'Mark settled', to: 'SETTLED', loud: true });
    if (p.seesMoney && o.status === 'SETTLED') btns.push({ label: 'Reopen', to: 'WORK_DONE' });
  }
  const [sure, setSure] = useState(false);
  const statementHref = `/studio/vendors/orders/${o.id}/statement`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {btns.map((b) => (
          <button key={b.to} type="button" className={b.loud ? 's-btn' : 's-btn-ghost'} disabled={r.pending} onClick={() => go(b.to)}>
            {b.label}
          </button>
        ))}
        {p.seesMoney ? (
          <>
            <Link href={statementHref} className="s-btn-ghost no-underline">
              Statement
            </Link>
            {o.money ? (
              <button
                type="button"
                className="s-btn-ghost"
                title="Opens your own WhatsApp with the message. The link opens only for your studio's team; forward the printed PDF if the crew wants it."
                onClick={() =>
                  window.open(
                    statementWhatsApp(
                      o.crewPhone,
                      `Namaste ${o.crewName.split(' ')[0]}, your statement for WO-${o.number} (${o.projectName}): billed ${rupees(o.money!.billPaise)}, paid ${rupees(o.money!.paidPaise)}, balance ${rupees(Math.max(0, o.money!.balancePaise))}. ${window.location.origin}${statementHref}`,
                    ),
                    '_blank',
                    'noopener',
                  )
                }
              >
                Send on WhatsApp
              </button>
            ) : null}
          </>
        ) : null}
        {p.canBuild || p.seesMoney ? (
          o.archived ? (
            <button type="button" className="s-btn-ghost" disabled={r.pending} onClick={() => r.run(() => archiveOrderAction(p.projectId, o.id, false))}>
              Restore
            </button>
          ) : o.paymentCount === 0 && p.canBuild ? (
            <button
              type="button"
              className="s-btn-ghost"
              disabled={r.pending}
              onClick={() => {
                if (!sure) {
                  setSure(true);
                  setTimeout(() => setSure(false), 4000);
                  return;
                }
                r.run(() => removeOrderAction(p.projectId, o.id));
              }}
            >
              {sure ? 'Sure? Remove it' : 'Remove work order'}
            </button>
          ) : (
            <button type="button" className="s-btn-ghost" disabled={r.pending} onClick={() => r.run(() => archiveOrderAction(p.projectId, o.id, true))}>
              Archive
            </button>
          )
        ) : null}
      </div>
      {o.status === 'WORK_DONE' && o.workDoneByName ? <p className={`m-0 ${muted}`}>Work done, marked by {o.workDoneByName}.</p> : null}
      <Message m={r.message} />
    </div>
  );
}

function Payments({ p }: { p: CardProps }) {
  const o = p.order;
  const m = o.money!;
  const r = useRun();
  const [paying, setPaying] = useState(false);
  const canAdvance = (p.advanceLimitPaise ?? 0) > 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[14px] font-semibold">Payments</p>
        {p.canPay && !o.archived && !paying && (m.balancePaise > TOLERANCE_PAISE || canAdvance) ? (
          <button type="button" className="s-btn" onClick={() => setPaying(true)}>
            Record payment
          </button>
        ) : null}
      </div>
      {paying ? <PayForm p={p} onDone={() => setPaying(false)} /> : null}
      {o.payments!.length === 0 ? (
        <p className={`m-0 ${muted}`}>Nothing paid yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <tbody>
              {o.payments!.map((x) => (
                <tr key={x.id} className={x.corrected || x.kind === 'CORRECTION' ? 'text-[var(--s-ink-3)]' : undefined}>
                  <td className={`${cell} ${num}`}>{dayWords(x.paidOn)}</td>
                  <td className={cell}>
                    {x.kind === 'ADVANCE' ? 'Advance' : x.kind === 'CORRECTION' ? 'Correction' : 'Payment'} · {x.mode}
                    {x.reference ? ` · ${x.reference}` : ''}
                    {x.note ? <span className={`block ${muted}`}>{x.note}</span> : null}
                    <span className={`block ${muted}`}>by {x.byName}</span>
                  </td>
                  <td className={`${cell} ${num} text-right ${x.corrected ? 'line-through' : ''}`}>{rupees(x.amountPaise)}</td>
                  <td className={`${cell} text-right`}>
                    {p.canPay && x.kind !== 'CORRECTION' && !x.corrected ? (
                      <button
                        type="button"
                        className="text-[12px] text-[var(--s-ink-3)] hover:text-[var(--s-bad)]"
                        disabled={r.pending}
                        onClick={() => {
                          const note = window.prompt('Why is this payment being reversed? (It stays on the record with its correction.)', 'Recorded by mistake');
                          if (note !== null) r.run(() => correctCrewPaymentAction(p.projectId, x.id, note));
                        }}
                      >
                        Reverse
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Message m={r.message} />
    </div>
  );
}

function PayForm({ p, onDone }: { p: CardProps; onDone: () => void }) {
  const o = p.order;
  const m = o.money!;
  const balance = Math.max(0, m.balancePaise);
  const [amount, setAmount] = useState(balance > 0 ? String(balance / 100) : '');
  const [kind, setKind] = useState<'PAYMENT' | 'ADVANCE'>(balance > TOLERANCE_PAISE ? 'PAYMENT' : 'ADVANCE');
  const [mode, setMode] = useState('UPI');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('Running bill');
  const [paidOn, setPaidOn] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const r = useRun();
  const typed = Math.round(Number(amount.replace(/,/g, '')) * 100);
  const after = Number.isFinite(typed) ? m.balancePaise - typed : m.balancePaise;
  return (
    <form
      className="flex flex-col gap-2.5 rounded-[10px] bg-[var(--s-surface-2)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        r.run(() => recordCrewPaymentAction(p.projectId, o.id, { amountRupees: amount, kind, mode, reference, note, paidOn }), onDone);
      }}
    >
      <p className="m-0 text-[13.5px]">
        <span className="font-semibold">{o.crewName}</span> · {o.trades.map((t) => t.label).join(', ')} · {o.projectName}. Balance {rupees(balance)} of {rupees(m.billPaise)} billed.
      </p>
      {p.payee && (p.payee.upiId || p.payee.bankAccountMasked) ? (
        <p className={`m-0 ${muted}`}>
          Pay to: {[p.payee.upiId ? `UPI ${p.payee.upiId}` : null, p.payee.bankAccountMasked ? `${p.payee.bankAccountName ?? 'Account'} ${p.payee.bankAccountMasked} · ${p.payee.bankIfsc ?? ''}` : null].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {quickAmounts(balance).map((q) => (
          <button key={q.label} type="button" className="s-btn-ghost px-2.5 py-1 text-[12.5px]" onClick={() => setAmount(String(q.amountPaise / 100))}>
            {q.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="s-label">Amount ₹</span>
          <input className="s-input s-num w-[140px]" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="s-label">Kind</span>
          <select className="s-input w-auto" value={kind} onChange={(e) => setKind(e.target.value as 'PAYMENT' | 'ADVANCE')}>
            <option value="PAYMENT">Running bill</option>
            <option value="ADVANCE">Advance</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="s-label">Mode</span>
          <select className="s-input w-auto" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="UPI">UPI</option>
            <option value="BANK">Bank transfer</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="s-label">Date</span>
          <input type="date" className="s-input w-auto" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="s-input" aria-label="Reference" placeholder="UTR or cheque number" value={reference} onChange={(e) => setReference(e.target.value)} />
        <input className="s-input" aria-label="Note" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <p className={`m-0 ${muted}`}>
        {kind === 'ADVANCE'
          ? `An advance may run up to ${rupees(p.advanceLimitPaise ?? 0)} ahead of the bill.`
          : after < -TOLERANCE_PAISE
            ? 'That is more than the balance: it will be refused.'
            : `Balance after: ${rupees(Math.max(0, after))}`}
      </p>
      <div className="flex gap-2">
        <button type="submit" className="s-btn" disabled={r.pending}>
          Record payment
        </button>
        <button type="button" className="s-btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
      <Message m={r.message} />
    </form>
  );
}
