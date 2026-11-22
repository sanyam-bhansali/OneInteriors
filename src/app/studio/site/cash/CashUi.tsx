'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { myCash } from '@/modules/petty-cash/store';
import { readyPhoto } from '../lib/photo';
import { logExpenseAction, markReceivedAction } from './actions';

type Cash = NonNullable<Awaited<ReturnType<typeof myCash>>>;

const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function CashScreen({ cash }: { cash: Cash }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  const b = cash.balance;
  const toMark = cash.cash.filter((c) => !c.received);
  return (
    <>
      <section className="st-card" aria-label="With me">
        <span className="muted" style={{ fontSize: 13 }}>
          With me now
        </span>
        <b style={{ fontSize: 28, color: b.pending < 0 ? 'var(--bad)' : undefined }}>{inr(b.pending)}</b>
        <span className="muted" style={{ fontSize: 13 }}>
          Given {inr(b.given)} · spent {inr(b.spent)}
          {b.pending < 0 ? ' · you have spent more than you were given' : ''}
        </span>
      </section>

      {msg ? (
        <p role="status" style={{ margin: 0, color: msg.ok ? 'var(--good)' : 'var(--bad)' }}>
          {msg.text}
        </p>
      ) : null}

      {toMark.length > 0 ? (
        <section className="st-card" aria-label="To mark received">
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Money sent to you</h2>
          {toMark.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>
                <b>{inr(c.amountPaise)}</b> <span className="muted">· {day(c.givenOn)} · by {c.by}</span>
                {c.note ? <span className="muted" style={{ display: 'block', fontSize: 13 }}>{c.note}</span> : null}
              </span>
              <button type="button" className="st-fill small" disabled={pending} onClick={() => run(() => markReceivedAction(c.id))}>
                Mark received
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <Expense cash={cash} pending={pending} run={run} />

      {cash.expenses.length > 0 ? (
        <section className="st-card" aria-label="My expenses">
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>My expenses</h2>
          {cash.expenses.map((e) => (
            <div key={e.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>
                  <b>{inr(e.amountPaise)}</b> · {e.note}
                </span>
                <span className="muted" style={{ fontSize: 13 }}>
                  {day(e.spentOn)}
                </span>
              </div>
              <span className="muted" style={{ fontSize: 13 }}>
                {e.project}
                {e.reviewed?.rejected ? ' · rejected by accounts' : e.flags.length && !e.reviewed ? ' · accounts will check it' : ''}
              </span>
            </div>
          ))}
        </section>
      ) : null}

      {cash.cash.some((c) => c.received) ? (
        <section className="st-card" aria-label="Received">
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Received</h2>
          {cash.cash
            .filter((c) => c.received)
            .map((c) => (
              <span key={c.id}>
                <b>{inr(c.amountPaise)}</b> <span className="muted">· {day(c.givenOn)} · by {c.by}</span>
              </span>
            ))}
        </section>
      ) : null}
    </>
  );
}

/** The expense: amount, project (mine first), what for, the day, and the bill photo (needed). */
function Expense({ cash, pending, run }: { cash: Cash; pending: boolean; run: (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, after?: () => void) => void }) {
  const [amount, setAmount] = useState('');
  const [projectId, setProject] = useState(cash.mine.length === 1 ? cash.mine[0]!.id : '');
  const [note, setNote] = useState('');
  const [spentOn, setSpentOn] = useState(cash.today);
  const [bill, setBill] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reset = () => {
    setAmount('');
    setNote('');
    setBill(null);
    if (fileRef.current) fileRef.current.value = '';
  };
  return (
    <form
      className="st-card"
      aria-label="Put in an expense"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!bill) return;
        setPreparing(true);
        let photo: Blob = bill;
        let type = bill.type;
        try {
          const ready = await readyPhoto(bill, true);
          photo = ready.blob;
          type = ready.type;
        } catch {
          /* send as it is */
        } finally {
          setPreparing(false);
        }
        const form = new FormData();
        form.set('amount', amount);
        form.set('projectId', projectId);
        form.set('note', note);
        form.set('spentOn', spentOn);
        form.set('bill', new File([photo], type === 'image/png' ? 'bill.png' : 'bill.jpg', { type }));
        run(() => logExpenseAction(form), reset);
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Put in an expense</h2>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        Amount (₹)
        <input className="st-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="450" required />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        Project
        <select className="st-input" value={projectId} onChange={(e) => setProject(e.target.value)} required>
          <option value="">Pick the project</option>
          {cash.mine.length ? (
            <optgroup label="My sites">
              {cash.mine.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {cash.others.length ? (
            <optgroup label="Other sites">
              {cash.others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        What for
        <input className="st-input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Hinges and screws" required />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        Day
        <input className="st-input" type="date" value={spentOn} max={cash.today} onChange={(e) => setSpentOn(e.target.value)} required />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        Bill photo or payment screenshot (needed)
        <input ref={fileRef} className="st-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setBill(e.target.files?.[0] ?? null)} required />
      </label>
      <button type="submit" className="st-fill" disabled={pending || preparing || !bill}>
        {preparing ? 'Getting the photo ready…' : pending ? 'Saving…' : 'Mark spent'}
      </button>
    </form>
  );
}
