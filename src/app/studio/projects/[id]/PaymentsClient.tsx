'use client';

import { useState, useTransition } from 'react';
import { formatINR } from '@/lib/money';
import { MODE_LABEL, parseRupees, PAYMENT_MODES, type PaymentModeName } from '@/modules/project/payment-ledger';
import { correctPaymentAction, recordPaymentAction, setDueAction } from './money-actions';

/**
 * Marking money received (studio workspace Phase 5): the stage and its open
 * amount are filled in, today's date too, so the usual case is one tap on
 * how it was paid, the receipt, and Save. Amounts show back with Indian
 * grouping. Overpaying is refused by the server with the difference said.
 */

export interface RecorderStage {
  index: number;
  label: string;
  openPaise: number;
}

const field = 's-input w-full';
const lbl = 'text-[13px] font-semibold text-[var(--s-ink-2)]';

const rupeesText = (paise: number) => formatINR(paise, { symbol: false, paise: paise % 100 !== 0 });

export function RecordPayment({
  projectId,
  customer,
  stages,
  suggested,
  today,
}: {
  projectId: string;
  customer: string;
  stages: RecorderStage[];
  suggested: number | null;
  today: string;
}) {
  const open = stages.filter((s) => s.openPaise > 0);
  const first = open.find((s) => s.index === suggested) ?? open[0] ?? null;
  const [show, setShow] = useState(false);
  const [stage, setStage] = useState<number | null>(first?.index ?? null);
  const [amount, setAmount] = useState(first ? rupeesText(first.openPaise) : '');
  const [day, setDay] = useState(today);
  const [mode, setMode] = useState<PaymentModeName | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (open.length === 0) {
    return <p className="m-0 text-[13.5px] text-[var(--s-ink-3)]">Every stage is recorded in full.</p>;
  }

  const current = stages.find((s) => s.index === stage) ?? null;
  const paise = parseRupees(amount);
  const over = current && paise !== null && paise > current.openPaise ? paise - current.openPaise : 0;

  if (!show) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="s-btn self-start"
          onClick={() => {
            // The figures may have moved since this page loaded (a payment just saved): start from what is open now.
            if (first) {
              setStage(first.index);
              setAmount(rupeesText(first.openPaise));
            }
            setDay(today);
            setShow(true);
          }}
        >
          Mark a payment received
        </button>
        {message ? (
          <p role="status" className={`m-0 text-[13px] ${message.ok ? 'text-[var(--s-good)]' : 'text-[var(--s-bad)]'}`}>
            {message.text}
          </p>
        ) : null}
      </div>
    );
  }

  const save = () =>
    start(async () => {
      setMessage(null);
      const data = new FormData();
      data.set('projectId', projectId);
      data.set('stageIndex', String(stage ?? ''));
      data.set('amount', amount);
      data.set('receivedOn', day);
      if (mode) data.set('mode', mode);
      if (note.trim()) data.set('note', note);
      if (receipt) data.set('receipt', receipt);
      const r = await recordPaymentAction(data);
      if (r.ok) {
        setMessage({ ok: true, text: `Recorded. ${customer} is asked to confirm it, and the receipt is in the locker.` });
        setShow(false);
        setReceipt(null);
        setNote('');
        setMode(null);
      } else setMessage({ ok: false, text: r.error ?? 'Could not save.' });
    });

  return (
    <form
      className="flex flex-col gap-4 rounded-[12px] border border-[var(--s-rule)] bg-[var(--s-surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={lbl}>Which payment</span>
          <select
            className={field}
            value={stage ?? ''}
            onChange={(e) => {
              const s = stages.find((x) => x.index === Number(e.target.value));
              setStage(s?.index ?? null);
              if (s) setAmount(rupeesText(s.openPaise));
            }}
          >
            {open.map((s) => (
              <option key={s.index} value={s.index}>
                {s.label} · {formatINR(s.openPaise)} open
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={lbl}>Amount received</span>
          <span className="flex items-center gap-2">
            <span className="text-[14px] text-[var(--s-ink-3)]">₹</span>
            <input
              className={`${field} s-num font-[family-name:var(--font-mono)]`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => {
                const p = parseRupees(amount);
                if (p !== null) setAmount(rupeesText(p));
              }}
              aria-describedby="pay-amount-hint"
            />
          </span>
          <span id="pay-amount-hint" className={`text-[12.5px] ${over ? 'text-[var(--s-bad)]' : 'text-[var(--s-ink-3)]'}`}>
            {over
              ? `${formatINR(over)} more than the ${formatINR(current!.openPaise)} open on ${current!.label}. Record the extra against the next payment.`
              : paise !== null && current && paise < current.openPaise
                ? `Part payment: ${formatINR(current.openPaise - paise)} will still be open.`
                : 'The full amount open on this stage.'}
          </span>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <label className="flex flex-col gap-1.5">
          <span className={lbl}>Day it arrived</span>
          <input type="date" className={field} value={day} max={today} onChange={(e) => setDay(e.target.value)} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className={lbl} id="pay-mode">
            How it was paid
          </span>
          <div role="radiogroup" aria-labelledby="pay-mode" className="flex flex-wrap gap-1.5">
            {PAYMENT_MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className="min-h-[40px] rounded-full border px-4 text-[13.5px]"
                style={
                  mode === m
                    ? { background: 'var(--s-accent)', borderColor: 'var(--s-accent)', color: '#fff' }
                    : { background: 'var(--s-surface)', borderColor: 'var(--s-rule)', color: 'var(--s-ink)' }
                }
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={lbl}>Receipt (photo or PDF) · filed in {customer}&rsquo;s locker</span>
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-[13px]" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
      </label>

      <div className="rounded-[10px] bg-[var(--s-surface-2)] p-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-[var(--s-ink-2)]">Note · only your team</span>
          <input className={field} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="UTR, cheque number, who paid" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="s-btn" disabled={pending || stage === null || !paise || over > 0 || !mode || !day}>
          {pending ? 'Saving…' : paise ? `Record ${formatINR(paise)} received` : 'Record received'}
        </button>
        <button type="button" className="s-btn-ghost" onClick={() => setShow(false)}>
          Cancel
        </button>
        {!mode ? <span className="text-[12.5px] text-[var(--s-ink-3)]">Pick how it was paid.</span> : null}
      </div>
      <p className="m-0 text-[12.5px] text-[var(--s-ink-3)]">It counts as paid once {customer} confirms it in the app. Entries are never edited; a mistake is corrected with a new entry.</p>
      {message && !message.ok ? (
        <p role="alert" className="m-0 text-[13px] text-[var(--s-bad)]">
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

/** Correct an entry: a new one replaces it (the old stays, marked corrected). 0 = recorded by mistake. */
export function CorrectPayment({ projectId, paymentId, amountPaise }: { projectId: string; paymentId: string; amountPaise: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(rupeesText(amountPaise));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (value: string) =>
    start(async () => {
      setError(null);
      const r = await correctPaymentAction(projectId, paymentId, value);
      if (r.ok) setOpen(false);
      else setError(r.error ?? 'Could not save.');
    });
  if (!open) {
    return (
      <button type="button" className="text-[12.5px] text-[var(--s-ink-3)] underline hover:text-[var(--s-accent)]" onClick={() => setOpen(true)}>
        Correct
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-[var(--s-ink-3)]">₹</span>
      <input className="s-input w-[9rem] s-num font-[family-name:var(--font-mono)]" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Corrected amount, in rupees" />
      <button type="button" className="s-btn-ghost" disabled={pending} onClick={() => run(amount)}>
        Save
      </button>
      <button type="button" className="s-btn-ghost" disabled={pending} onClick={() => run('0')}>
        Recorded by mistake
      </button>
      <button type="button" className="text-[12.5px] text-[var(--s-ink-3)] underline" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error ? <span role="alert" className="basis-full text-[12.5px] text-[var(--s-bad)]">{error}</span> : null}
    </span>
  );
}

/** A stage's due date: the customer is reminded two days before. */
export function DueDate({ projectId, index, value, label }: { projectId: string; index: number; value: string | null; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-col gap-1">
      <input
        type="date"
        className="s-input w-[11rem]"
        defaultValue={value ?? ''}
        disabled={pending}
        aria-label={`When ${label} is due`}
        onChange={(e) => {
          const day = e.target.value;
          start(async () => {
            setError(null);
            setSaved(false);
            const r = await setDueAction(projectId, index, day);
            if (r.ok) setSaved(true);
            else setError(r.error ?? 'Could not save.');
          });
        }}
      />
      {error ? (
        <span role="alert" className="text-[12.5px] text-[var(--s-bad)]">
          {error}
        </span>
      ) : saved ? (
        <span role="status" className="text-[12.5px] text-[var(--s-good)]">
          Saved. The customer is reminded two days before.
        </span>
      ) : null}
    </span>
  );
}
