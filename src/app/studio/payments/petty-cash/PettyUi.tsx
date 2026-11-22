'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ExpenseRow } from '@/modules/petty-cash/store';
import { FLAG_LABEL } from '@/modules/petty-cash/rules';
import { giveCashAction, reviewExpenseAction } from './actions';

const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
type Result = { ok: true; message: string } | { ok: false; error: string };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  return { pending, msg, run };
}

function Said({ msg }: { msg: { ok: boolean; text: string } | null }) {
  return msg ? (
    <p role="status" className="m-0 text-[13px]" style={{ color: msg.ok ? 'var(--good)' : 'var(--bad)' }}>
      {msg.text}
    </p>
  ) : null;
}

/** Enter petty cash given (sent to their bank; the value lands on their phone to mark received). */
export function GiveCash({ team, today }: { team: { id: string; name: string }[]; today: string }) {
  const { pending, msg, run } = useRun();
  const [memberId, setMember] = useState('');
  const [amount, setAmount] = useState('');
  const [givenOn, setGivenOn] = useState(today);
  const [note, setNote] = useState('');
  return (
    <form
      className="card flex flex-wrap items-end gap-2"
      aria-label="Give petty cash"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => giveCashAction({ memberId, amount, givenOn, note }), () => {
          setAmount('');
          setNote('');
        });
      }}
    >
      <h2 className="m-0 w-full text-[15px] font-semibold">Give petty cash</h2>
      <label className="flex flex-col gap-1 text-[13px]">
        To
        <select className="fld" value={memberId} onChange={(e) => setMember(e.target.value)} required>
          <option value="">Pick a person</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Amount (₹)
        <input className="fld" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" required />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Sent on
        <input className="fld" type="date" value={givenOn} max={today} onChange={(e) => setGivenOn(e.target.value)} required />
      </label>
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[13px]">
        Note
        <input className="fld" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="UPI ref, for the Baner sites" />
      </label>
      <button type="submit" className="btn pri sm" disabled={pending}>
        {pending ? 'Saving…' : 'Enter'}
      </button>
      <div className="w-full">
        <Said msg={msg} />
      </div>
    </form>
  );
}

/** Expenses with their flags and reasons; accounts clears the flags or rejects the expense, with a note. */
export function ExpenseList({ rows, review }: { rows: ExpenseRow[]; review: boolean }) {
  const { pending, msg, run } = useRun();
  const act = (id: string, action: 'clear' | 'reject') => {
    const note = window.prompt(action === 'clear' ? 'Why is it fine? (a few words)' : 'Why is it rejected? (a few words)');
    if (note === null) return;
    run(() => reviewExpenseAction(id, action, note));
  };
  return (
    <div className="flex flex-col gap-2">
      <Said msg={msg} />
      <ul className="m-0 list-none p-0">
        {rows.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-[var(--line)] py-2 text-[13.5px]">
            <span className="min-w-0">
              <b>{inr(e.amountPaise)}</b> · {e.note} <span className="muted">· {e.project} · paid by {e.who} · {day(e.spentOn)}</span>
              {e.read ? <span className="muted block text-[12.5px]">Bill reads: {e.read}</span> : null}
              {e.flags.map((f) => (
                <span key={f.code} className="block text-[12.5px]" style={{ color: e.reviewed ? 'var(--muted)' : 'var(--bad)' }}>
                  ⚑ {FLAG_LABEL[f.code]}: {f.reason}
                </span>
              ))}
              {e.reviewed ? (
                <span className="block text-[12.5px] muted">
                  {e.reviewed.rejected ? 'Rejected' : 'Cleared'}
                  {e.reviewed.note ? `: ${e.reviewed.note}` : ''}
                </span>
              ) : null}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {e.billUrl ? (
                <a href={e.billUrl} target="_blank" rel="noreferrer" className="btn ghost sm">
                  Bill
                </a>
              ) : null}
              {review && !e.reviewed && e.flags.length ? (
                <button type="button" className="btn sec sm" disabled={pending} onClick={() => act(e.id, 'clear')}>
                  Clear flag
                </button>
              ) : null}
              {review && !e.reviewed ? (
                <button type="button" className="btn ghost sm" disabled={pending} onClick={() => act(e.id, 'reject')}>
                  Reject
                </button>
              ) : null}
              {review && e.reviewed ? (
                <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => reviewExpenseAction(e.id, 'undo', ''))}>
                  Undo
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
