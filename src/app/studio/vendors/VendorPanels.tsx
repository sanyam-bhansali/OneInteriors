'use client';

import { useActionState, useState } from 'react';
import { formatINR, paiseToRupees } from '@/lib/money';
import { UNIT_LABELS, formatQty, type QuoteUnitName } from '@/modules/studio-quote/pricing';
// Pure module for the vocabulary; the row types stay with the server module,
// and `import type` is erased so it costs the bundle nothing.
import {
  COMMON_TRADES,
  MODE_LABELS,
  type PaymentModeName,
} from '@/modules/studio-practice/vocabulary';
import type { WorkOrderRow, VendorRow } from '@/modules/studio-practice/vendors';
import { addVendorAction, addWorkOrderAction, addLineAction, payAction, IDLE, type State } from './actions';

const input =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[13.5px] text-[var(--s-ink)] placeholder:text-[var(--s-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const primary =
  'rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[14px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40';
const quiet =
  'rounded-[8px] border border-[var(--s-rule)] px-3 py-1.5 text-[13px] font-medium hover:border-[var(--s-ink-3)] disabled:opacity-40';

function Err({ state }: { state: State }) {
  // Narrowed rather than cast. A cast here would compile against any shape and
  // silently render `undefined` the day the action's result type changes.
  if (!('ok' in state) || state.ok) return null;
  return (
    <p role="alert" className="m-0 text-[12.5px] text-[var(--s-bad)]">
      {state.error}
    </p>
  );
}

export function AddVendor() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addVendorAction, IDLE);

  if (!open) {
    return (
      <div className="relative">
        <button type="button" onClick={() => setOpen(true)} className={primary}>
          + Add a vendor
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <form action={action} className="s-card absolute right-0 top-full z-20 mt-2 flex w-[min(25rem,calc(100vw-2rem))] flex-col gap-3 p-5 shadow-lg">
        <p className="m-0 text-[15px] font-semibold">Add a vendor</p>

        <label className="flex flex-col gap-1.5">
          <span className="s-label">Name</span>
          <input name="name" required autoFocus placeholder="Ramesh Carpentry" className={input} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="s-label">Trade</span>
          <input name="trade" required list="trades" placeholder="Carpentry" className={input} />
          <datalist id="trades">
            {COMMON_TRADES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="s-label">Phone — optional</span>
          <input name="phone" inputMode="tel" className={input} />
        </label>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={primary}>
            {pending ? 'Adding…' : 'Add'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={quiet}>
            Cancel
          </button>
        </div>

        <Err state={state} />
      </form>
    </div>
  );
}

export function NewWorkOrder({
  projects,
  vendors,
}: {
  projects: { id: string; name: string }[];
  vendors: { id: string; name: string; trade: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addWorkOrderAction, IDLE);

  if (projects.length === 0 || vendors.length === 0) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={quiet}>
        + Raise a work order
      </button>
    );
  }

  return (
    <form action={action} className="s-card flex flex-wrap items-end gap-3 p-4">
      <label className="flex flex-col gap-1.5">
        <span className="s-label">Project</span>
        <select name="projectId" required className={input}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="s-label">Vendor</span>
        <select name="vendorId" required className={input}>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.name} — {v.trade}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="s-label">Due — optional</span>
        <input type="date" name="dueOn" className={input} />
      </label>

      <button type="submit" disabled={pending} className={primary}>
        {pending ? 'Raising…' : 'Raise'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className={quiet}>
        Cancel
      </button>

      <Err state={state} />
    </form>
  );
}

/**
 * One work order: what was agreed, what has been paid, what is left.
 *
 * The balance is computed from the lines and the payments every time this
 * renders. Nothing is stored — see the note at the top of `ledger.ts`. An
 * overpayment shows as a negative balance in red rather than being clamped to
 * zero, because a vendor paid twice is exactly what this table exists to catch.
 */
export function WorkOrderCard({ order }: { order: WorkOrderRow }) {
  const [open, setOpen] = useState(false);
  const [lineState, lineAction, linePending] = useActionState(addLineAction, IDLE);
  const [payState, payAct, payPending] = useActionState(payAction, IDLE);

  return (
    <li className="s-card overflow-hidden">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 bg-[var(--s-surface-2)] px-4 py-3">
        <span className="text-[14.5px] font-semibold">{order.vendorName}</span>
        <span className="s-tag">{order.trade}</span>
        <span className="text-[13px] text-[var(--s-ink-3)]">{order.projectName}</span>

        <span className="ml-auto flex flex-wrap items-baseline gap-x-4">
          <span className="s-num text-[13px] text-[var(--s-ink-3)]">
            {formatINR(order.paidPaise)} paid of {formatINR(order.billPaise)}
          </span>
          <span
            className={`s-num text-[15px] font-semibold ${
              order.overpaidPaise > 0
                ? 'text-[var(--s-bad)]'
                : order.settled
                  ? 'text-[var(--s-good)]'
                  : 'text-[var(--s-accent)]'
            }`}
          >
            {order.overpaidPaise > 0
              ? `${formatINR(order.overpaidPaise)} over`
              : order.settled
                ? 'Settled'
                : formatINR(order.balancePaise)}
          </span>
        </span>
      </div>

      {order.lines.length > 0 ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {order.lines.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[var(--s-rule-soft)] px-4 py-2 text-[13.5px] last:border-b-0"
            >
              <span className="flex-1">{l.description}</span>
              <span className="s-num text-[var(--s-ink-3)]">
                {l.qtyMilli ? `${formatQty(l.qtyMilli)} ${UNIT_LABELS[l.unit].toLowerCase()}` : '—'}
              </span>
              <span className="s-num text-[var(--s-ink-3)]">{formatINR(l.ratePaise)}</span>
              <span className="s-num w-[6rem] text-right font-medium">{formatINR(l.amountPaise)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 px-4 py-2.5 text-[13px] italic text-[var(--s-ink-3)]">
          Nothing on this order yet.
        </p>
      )}

      {order.payments.length > 0 ? (
        <ul className="m-0 flex list-none flex-col border-t border-[var(--s-rule)] bg-[var(--s-surface-2)] p-0">
          {order.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline gap-x-4 px-4 py-1.5 text-[12.5px]">
              <span className="text-[var(--s-ink-3)]">
                {p.paidOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ·{' '}
                {MODE_LABELS[p.mode]}
                {p.reference ? ` · ${p.reference}` : ''}
              </span>
              <span className="s-num ml-auto font-medium text-[var(--s-good)]">
                − {formatINR(p.amountPaise)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--s-rule)] px-4 py-2.5">
        <button type="button" onClick={() => setOpen(!open)} className={quiet}>
          {open ? 'Close' : 'Add work or record a payment'}
        </button>
      </div>

      {open ? (
        <div className="flex flex-col gap-4 border-t border-[var(--s-rule-soft)] px-4 py-4">
          <form action={lineAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="workOrderId" value={order.id} />
            <label className="flex flex-1 flex-col gap-1">
              <span className="s-label">What is the work</span>
              <input name="description" required placeholder="Wardrobe carcass and shutters" className={input} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="s-label">Unit</span>
              <select name="unit" defaultValue="SQFT" className={input}>
                {(Object.keys(UNIT_LABELS) as QuoteUnitName[])
                  .filter((u) => u !== 'AREA')
                  .map((u) => (
                    <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="s-label">Qty</span>
              <input name="qty" inputMode="decimal" required className={`${input} s-num w-[5.5rem] text-right`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="s-label">Rate ₹</span>
              <input name="rate" inputMode="decimal" required className={`${input} s-num w-[6rem] text-right`} />
            </label>
            <button type="submit" disabled={linePending} className={quiet}>
              {linePending ? '…' : 'Add'}
            </button>
            <Err state={lineState} />
          </form>

          <form action={payAct} className="flex flex-wrap items-end gap-2 border-t border-[var(--s-rule-soft)] pt-4">
            <input type="hidden" name="workOrderId" value={order.id} />
            <label className="flex flex-col gap-1">
              <span className="s-label">Pay ₹</span>
              <input
                name="amount"
                inputMode="decimal"
                required
                placeholder={order.balancePaise > 0 ? String(paiseToRupees(order.balancePaise)) : '0'}
                className={`${input} s-num w-[7rem] text-right`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="s-label">How</span>
              <select name="mode" defaultValue="BANK" className={input}>
                {(Object.keys(MODE_LABELS) as PaymentModeName[]).map((m) => (
                  <option key={m} value={m}>{MODE_LABELS[m]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="s-label">Reference — optional</span>
              <input name="reference" placeholder="UTR / cheque no." className={input} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="s-label">On</span>
              <input type="date" name="paidOn" className={input} />
            </label>
            <button type="submit" disabled={payPending} className={primary}>
              {payPending ? '…' : 'Record'}
            </button>
            <Err state={payState} />
          </form>
        </div>
      ) : null}
    </li>
  );
}

export function VendorList({ vendors }: { vendors: VendorRow[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2 xl:grid-cols-3">
      {vendors.map((v) => (
        <li key={v.id} className="s-card flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
          <span className="text-[14px] font-medium">{v.name}</span>
          <span className="s-tag">{v.trade}</span>
          {v.phone ? (
            <a href={`tel:${v.phone}`} className="s-num text-[12.5px] text-[var(--s-accent)] no-underline">
              {v.phone}
            </a>
          ) : null}
          <span
            className={`s-num ml-auto text-[14px] font-semibold ${
              v.balancePaise > 0 ? 'text-[var(--s-accent)]' : 'text-[var(--s-ink-3)]'
            }`}
          >
            {v.balancePaise > 0 ? formatINR(v.balancePaise) : '—'}
          </span>
        </li>
      ))}
    </ul>
  );
}
