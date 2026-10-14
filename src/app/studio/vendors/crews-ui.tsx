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
import { LineIcon } from '../ui/icons';
import '../office-ui.css';
import './vendors.css';

/**
 * The pieces every crew screen shares (Studio OS Phase 3): one work order
 * with its lines, quantities, extras, status and — for owner and accounts
 * only — rates, amounts and payments. The server has already taken the
 * money out of what a PM receives (studio-crews/rules.ts `stripMoney`), so
 * this component never has a figure to hide; it simply draws what it got.
 * The look is the owner's handoff (Vendors, 12 Oct 2026): a card per work
 * order, the design's money strip, a line table, chips for status.
 */

type Result = { ok: true; message: string } | { ok: false; error: string };

const num = 'mono';

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
    <p role={m.ok ? 'status' : 'alert'} className={m.ok ? 'ox-ok' : 'ox-err'}>
      {m.text}
    </p>
  );
}

/** The design's chip tones for a work order's status. */
const TONE: Record<WorkOrderStatusName, string> = {
  DRAFT: 'chip',
  ISSUED: 'chip oi',
  IN_PROGRESS: 'chip oi',
  WORK_DONE: 'chip warn',
  SETTLED: 'chip good',
};

export function StatusPill({ status, archived }: { status: WorkOrderStatusName; archived?: boolean }) {
  if (archived) return <span className="chip">Archived</span>;
  return (
    <span className={TONE[status]}>
      <span className="dot" aria-hidden="true" />
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
    <li className="card flush vd-wo">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="vd-wohead">
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <b>
            <span className="mono">WO-{o.number}</span> · {p.showProject ? o.projectName : o.crewName}
          </b>
          <span className={muted}>
            {p.showProject ? `${o.crewName} · ` : ''}
            {o.trades.map((t) => t.label).join(', ') || 'No trade'} · {o.lines.length} line{o.lines.length === 1 ? '' : 's'}
            {o.needPrice ? ` · ${o.needPrice} to price` : ''}
            {o.needQty ? ` · ${o.needQty} need a quantity` : ''}
            {o.dueOn ? ` · due ${dayWords(o.dueOn)}` : ''}
          </span>
        </span>
        <span className="hstack" style={{ gap: 14 }}>
          {m ? (
            <span className="sm">
              <span className="mono">{rupees(m.billPaise)}</span> <span className="muted">billed ·</span> <b className="mono">{rupees(m.balancePaise)}</b>{' '}
              <span className="muted">to pay</span>
            </span>
          ) : null}
          <StatusPill status={o.status} archived={o.archived} />
          <span aria-hidden="true" className="vd-caret">
            {open ? '▲' : '▼'}
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
    <div className="vd-wobody">
      {m ? (
        <MoneyStrip order={o} />
      ) : (
        <span className="team">
          <LineIcon name="lock" size={14} />
          Quantities only: rates, amounts and payments are kept by the owner and accounts.
        </span>
      )}
      {m && m.variancePaise > TOLERANCE_PAISE ? (
        <p className="vd-warnline">
          {rupees(m.variancePaise)} above the quotation&apos;s quantities (site measurement and extras). Check it before the next payment.
        </p>
      ) : null}

      <div className="tscroll">
        <table className="tbl vd-lines" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th scope="col">Line</th>
              <th scope="col">Crew item</th>
              <th scope="col" style={{ textAlign: 'right' }}>
                Quoted
              </th>
              <th scope="col">Measured</th>
              {m ? <th scope="col">Rate</th> : null}
              {m ? <th scope="col">Agreed</th> : null}
              {m ? (
                <th scope="col" style={{ textAlign: 'right' }}>
                  Amount
                </th>
              ) : null}
              {editable ? (
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <RoomRows key={room} room={room} lines={o.lines.filter((l) => l.room === room)} p={p} editable={editable} run={r.run} pending={r.pending} />
            ))}
          </tbody>
        </table>
      </div>
      {o.lines.length === 0 ? (
        <p className={muted} style={{ margin: 0 }}>
          No lines on it yet.
        </p>
      ) : null}
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
  const fig = (label: string, value: string, note?: string, due = false) => (
    <div className={due ? 'vd-due' : undefined}>
      <span className="sm">{label}</span>
      <b className="mono">{value}</b>
      {note ? <span className="muted sm">{note}</span> : null}
    </div>
  );
  return (
    <div className={`money${m.extrasPaise > 0 ? ' four' : ''}`}>
      {fig('Billed', rupees(m.billPaise), o.needPrice + o.needQty ? `+${o.needPrice + o.needQty} to price` : `client value ${rupees(m.clientValuePaise)}`)}
      {fig('Paid', rupees(m.paidPaise))}
      {fig(
        m.balancePaise < -TOLERANCE_PAISE ? 'Advance out' : 'Balance',
        rupees(Math.abs(m.balancePaise)),
        m.balancePaise < -TOLERANCE_PAISE ? 'recovered as work is priced' : undefined,
        true,
      )}
      {m.extrasPaise > 0 ? fig('Extras', rupees(m.extrasPaise), 'not in the quotation') : null}
    </div>
  );
}

function RoomRows({ room, lines, p, editable, run, pending }: { room: string; lines: LineView[]; p: CardProps; editable: boolean; run: ReturnType<typeof useRun>['run']; pending: boolean }) {
  const m = p.order.money;
  const cols = 4 + (m ? 3 : 0) + (editable ? 1 : 0);
  return (
    <>
      <tr className="vd-room">
        <td colSpan={cols}>{room}</td>
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
      <td>
        <b style={{ fontWeight: 600 }}>{l.product}</b>
        <span className="vd-tags">
          {l.isExtra ? <span className="chip">Extra</span> : null}
          {l.guessed ? (
            <span className="chip" title="The routing only guessed this trade. Fix it under Settings, Crews and trades.">
              Trade guessed
            </span>
          ) : null}
          {l.rateEdited ? <span className="chip">Rate edited</span> : null}
          {l.widthMm && l.heightMm ? (
            <span className={`${muted} mono`}>
              {l.widthMm} × {l.heightMm} mm
            </span>
          ) : null}
        </span>
        {l.carpentry && !l.isExtra ? (
          <span className="vd-seg" role="group" aria-label={`Carpentry for ${l.product}`}>
            {(['INSTALL', 'FULL'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={l.carpentry === mode}
                disabled={!(editable || money) || pending || l.carpentry === mode}
                onClick={() => run(() => setLineCarpentryAction(pid, l.id, mode))}
              >
                {mode === 'INSTALL' ? 'Installation only' : 'Full carpentry'}
              </button>
            ))}
          </span>
        ) : null}
      </td>
      <td>
        {l.item}
        <span className={muted} style={{ display: 'block' }}>
          per {CREW_UNIT_LABEL[l.unit]} · {l.tradeLabel}
        </span>
        {l.pending === 'price' ? (
          <span className="vd-tags">
            <span className="chip warn">Needs a price</span>
          </span>
        ) : null}
        {l.pending === 'qty' ? (
          <span className="vd-tags">
            <span className="chip warn">Needs a quantity</span>
          </span>
        ) : null}
      </td>
      <td className={num} style={{ textAlign: 'right' }}>
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
      <td>
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
        {l.overQuote ? (
          <span className="warn-t" style={{ display: 'block', fontSize: 12 }}>
            More than quoted
          </span>
        ) : null}
      </td>
      {m ? (
        <td>
          {money ? (
            <MoneyInput label={`Rate for ${l.product}`} initial={asRupees(l.ratePaise)} placeholder="Rate" onSave={(v) => run(() => setLinePriceAction(pid, l.id, { rateRupees: v }))} disabled={pending} suffix={`/${unitShort(l.unit)}`} />
          ) : (
            <span className={num}>{l.ratePaise === null ? '—' : `${rupees(l.ratePaise)}/${unitShort(l.unit)}`}</span>
          )}
        </td>
      ) : null}
      {m ? (
        <td>
          {money ? (
            <MoneyInput label={`Agreed amount for ${l.product}`} initial={asRupees(l.agreedPaise)} placeholder="Agreed ₹" onSave={(v) => run(() => setLinePriceAction(pid, l.id, { agreedRupees: v }))} disabled={pending} />
          ) : (
            <span className={num}>{l.agreedPaise === null ? '—' : rupees(l.agreedPaise)}</span>
          )}
        </td>
      ) : null}
      {m ? (
        <td className={num} style={{ textAlign: 'right', fontWeight: 500 }}>
          {l.pending ? <span className={muted}>to price</span> : rupees(l.amountPaise)}
        </td>
      ) : null}
      {editable ? (
        <td style={{ textAlign: 'right' }}>
          <button
            type="button"
            className={`ox-plain${sure ? ' bad-t' : ''}`}
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
      className={`fld sm fit num${warn ? ' warn-b' : ''}`}
      size={7}
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
    <span className="vd-money-in">
      <span className={muted}>₹</span>
      <input
        aria-label={label}
        inputMode="decimal"
        className="fld sm fit num"
        size={7}
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
        <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
          <LineIcon name="plus" size={15} />
          Add extra work
        </button>
      </div>
    );
  return (
    <form
      className="ox-panel"
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
      <b style={{ fontSize: 14 }}>Extra work, outside the quotation</b>
      <div className="vd-grid2">
        <input className="fld" aria-label="What was done" placeholder="What was done" value={what} onChange={(e) => setWhat(e.target.value)} required />
        <input className="fld" aria-label="Room" placeholder="Room (optional)" value={room} onChange={(e) => setRoom(e.target.value)} />
      </div>
      <div className="hstack" style={{ gap: 8 }}>
        <select className="fld fit" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as CrewUnitName)}>
          {CREW_UNITS.map((u) => (
            <option key={u} value={u}>
              {CREW_UNIT_LABEL[u]}
            </option>
          ))}
        </select>
        {unit !== 'LUMP' ? <input className="fld fit" size={9} aria-label="Quantity" inputMode="decimal" placeholder="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} /> : null}
        {p.seesMoney && unit !== 'LUMP' ? <input className="fld fit" size={9} aria-label="Rate in rupees" inputMode="decimal" placeholder="Rate ₹" value={rate} onChange={(e) => setRate(e.target.value)} /> : null}
        {p.seesMoney ? <input className="fld fit" size={10} aria-label="Agreed amount in rupees" inputMode="decimal" placeholder="Or agreed ₹" value={agreed} onChange={(e) => setAgreed(e.target.value)} /> : null}
      </div>
      {!p.seesMoney ? (
        <p className={muted} style={{ margin: 0 }}>
          Owner or accounts put the price on it.
        </p>
      ) : null}
      <div className="hstack" style={{ gap: 8 }}>
        <button type="submit" className="btn pri sm" disabled={r.pending}>
          Add it
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
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
    <div className="vd-settings">
      <div className="hstack" style={{ alignItems: 'flex-end' }}>
        <label className="ox-f">
          <span className="lbl">Pay by</span>
          <input type="date" className="fld sm fit" value={due} onChange={(e) => setDue(e.target.value)} disabled={closed} />
        </label>
        <button type="button" className="btn ghost sm" disabled={r.pending || closed || due === (o.dueOn ?? '')} onClick={() => r.run(() => editOrderAction(p.projectId, o.id, { dueOn: due }))}>
          Save date
        </button>
        {o.paymentCount === 0 && others.length > 0 && !closed ? (
          <>
            <label className="ox-f">
              <span className="lbl">Give it to another crew</span>
              <select className="fld sm fit" value={swapTo} onChange={(e) => setSwapTo(e.target.value)}>
                <option value="">Pick a crew</option>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn ghost sm" disabled={!swapTo || r.pending} onClick={() => r.run(() => swapCrewAction(p.projectId, o.id, swapTo))}>
              Change crew
            </button>
          </>
        ) : null}
      </div>
      {p.steps && p.steps.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p className="sm" style={{ margin: 0 }}>
            <b style={{ fontWeight: 600 }}>Linked tracker steps:</b> {o.steps.length ? o.steps.map((s) => `${s.done ? '✓ ' : ''}${s.label}`).join(' · ') : <span className="muted">none yet</span>}{' '}
            <button type="button" className="ox-plain" style={{ color: 'var(--acc)' }} onClick={() => setShowSteps(!showSteps)}>
              {showSteps ? 'Close' : 'Change'}
            </button>
          </p>
          {showSteps ? (
            <div className="vd-steps">
              {p.steps.map((s) => (
                <label key={s.id}>
                  <input type="checkbox" checked={steps.includes(s.id)} onChange={(e) => setSteps(e.target.checked ? [...steps, s.id] : steps.filter((x) => x !== s.id))} />
                  <span className={s.done ? 'muted' : undefined}>
                    {s.label} <span className="muted">· {s.stage}</span>
                  </span>
                </label>
              ))}
              <div>
                <button type="button" className="btn pri sm" disabled={r.pending} onClick={() => r.run(() => editOrderAction(p.projectId, o.id, { stepIds: steps }), () => setShowSteps(false))}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="hstack" style={{ gap: 8 }}>
        {btns.map((b) => (
          <button key={b.to} type="button" className={b.loud ? 'btn pri sm' : 'btn ghost sm'} disabled={r.pending} onClick={() => go(b.to)}>
            {b.label}
          </button>
        ))}
        {p.seesMoney ? (
          <>
            <Link href={statementHref} className="btn ghost sm">
              Statement
            </Link>
            {o.money ? (
              <button
                type="button"
                className="btn ghost sm"
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
            <button type="button" className="btn ghost sm" disabled={r.pending} onClick={() => r.run(() => archiveOrderAction(p.projectId, o.id, false))}>
              Restore
            </button>
          ) : o.paymentCount === 0 && p.canBuild ? (
            <button
              type="button"
              className={`btn ghost sm${sure ? ' bad-b' : ''}`}
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
            <button type="button" className="btn ghost sm" disabled={r.pending} onClick={() => r.run(() => archiveOrderAction(p.projectId, o.id, true))}>
              Archive
            </button>
          )
        ) : null}
      </div>
      {o.status === 'WORK_DONE' && o.workDoneByName ? (
        <p className={muted} style={{ margin: 0 }}>
          Work done, marked by {o.workDoneByName}.
        </p>
      ) : null}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="chead">
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Payments</h3>
        {p.canPay && !o.archived && !paying && (m.balancePaise > TOLERANCE_PAISE || canAdvance) ? (
          <button type="button" className="btn pri sm" onClick={() => setPaying(true)}>
            Record payment
          </button>
        ) : null}
      </div>
      {paying ? <PayForm p={p} onDone={() => setPaying(false)} /> : null}
      {o.payments!.length === 0 ? (
        <p className={muted} style={{ margin: 0 }}>
          Nothing paid yet.
        </p>
      ) : (
        <div className="tscroll">
          <table className="tbl vd-pay" style={{ minWidth: 520 }}>
            <tbody>
              {o.payments!.map((x) => (
                <tr key={x.id} className={x.corrected || x.kind === 'CORRECTION' ? 'vd-off' : undefined}>
                  <td className={num}>{dayWords(x.paidOn)}</td>
                  <td>
                    {x.kind === 'ADVANCE' ? 'Advance' : x.kind === 'CORRECTION' ? 'Correction' : 'Payment'} · {x.mode}
                    {x.reference ? ` · ${x.reference}` : ''}
                    {x.note ? (
                      <span className={muted} style={{ display: 'block' }}>
                        {x.note}
                      </span>
                    ) : null}
                    <span className={muted} style={{ display: 'block' }}>
                      by {x.byName}
                    </span>
                  </td>
                  <td className={`${num}${x.corrected ? ' vd-strike' : ''}`} style={{ textAlign: 'right' }}>
                    {rupees(x.amountPaise)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {p.canPay && x.kind !== 'CORRECTION' && !x.corrected ? (
                      <button
                        type="button"
                        className="ox-plain"
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
  const over = kind !== 'ADVANCE' && after < -TOLERANCE_PAISE;
  return (
    <form
      className="ox-panel"
      onSubmit={(e) => {
        e.preventDefault();
        r.run(() => recordCrewPaymentAction(p.projectId, o.id, { amountRupees: amount, kind, mode, reference, note, paidOn }), onDone);
      }}
    >
      <p className="sm" style={{ margin: 0 }}>
        <b style={{ fontWeight: 600 }}>{o.crewName}</b> · {o.trades.map((t) => t.label).join(', ')} · {o.projectName}. Balance <span className="mono">{rupees(balance)}</span> of{' '}
        <span className="mono">{rupees(m.billPaise)}</span> billed.
      </p>
      {p.payee && (p.payee.upiId || p.payee.bankAccountMasked) ? (
        <p className={muted} style={{ margin: 0 }}>
          Pay to: {[p.payee.upiId ? `UPI ${p.payee.upiId}` : null, p.payee.bankAccountMasked ? `${p.payee.bankAccountName ?? 'Account'} ${p.payee.bankAccountMasked} · ${p.payee.bankIfsc ?? ''}` : null].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      <div className="tabs" role="group" aria-label="Quick amounts">
        {quickAmounts(balance).map((q) => (
          <button key={q.label} type="button" aria-pressed={amount === String(q.amountPaise / 100)} onClick={() => setAmount(String(q.amountPaise / 100))}>
            {q.label}
          </button>
        ))}
      </div>
      <div className="hstack" style={{ alignItems: 'flex-end', gap: 8 }}>
        <label className="ox-f">
          <span className="lbl">Amount ₹</span>
          <input className="fld fit num" size={11} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="ox-f">
          <span className="lbl">Kind</span>
          <select className="fld fit" value={kind} onChange={(e) => setKind(e.target.value as 'PAYMENT' | 'ADVANCE')}>
            <option value="PAYMENT">Running bill</option>
            <option value="ADVANCE">Advance</option>
          </select>
        </label>
        <label className="ox-f">
          <span className="lbl">Mode</span>
          <select className="fld fit" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="UPI">UPI</option>
            <option value="BANK">Bank transfer</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </label>
        <label className="ox-f">
          <span className="lbl">Date</span>
          <input type="date" className="fld fit" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </label>
      </div>
      <div className="vd-grid2">
        <input className="fld" aria-label="Reference" placeholder="UTR or cheque number" value={reference} onChange={(e) => setReference(e.target.value)} />
        <input className="fld" aria-label="Note" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {over ? (
        <span className="chip bad" style={{ minHeight: 34, alignSelf: 'flex-start', whiteSpace: 'normal' }}>
          <span className="dot" />
          That is more than the balance: it will be refused.
        </span>
      ) : (
        <p className={muted} style={{ margin: 0 }}>
          {kind === 'ADVANCE' ? `An advance may run up to ${rupees(p.advanceLimitPaise ?? 0)} ahead of the bill.` : `Balance after: ${rupees(Math.max(0, after))}`}
        </p>
      )}
      <div className="hstack" style={{ gap: 8 }}>
        <button type="submit" className="btn pri" disabled={r.pending}>
          Record payment
        </button>
        <button type="button" className="btn ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
      <Message m={r.message} />
    </form>
  );
}

