'use client';

import { useState, useTransition } from 'react';
import type { HoldView } from '@/modules/studio-hold/store';
import { askHoldAction, decideHoldAction, endHoldAction, withdrawHoldAction } from './hold-actions';

/**
 * A project on hold (owner, 12 Nov 2026): a designer asks with a reason, the
 * design head or the owner approves, and taking it off moves the plan by the
 * days it was on hold, on the client's side. While on, nothing counts late.
 */

const muted = 'text-[12.5px] text-[var(--muted)]';
const dayWords = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
const plural = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

type Result = { ok: true; message: string } | { ok: false; error: string };

export function HoldCard({ view, customer }: { view: HoldView; customer: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) after?.();
    });
  const o = view.open;
  if (!o && !view.canAsk && !message) return null;

  return (
    <section aria-label="On hold" className={`card flex flex-col gap-2 p-4 ${o?.status === 'ON' ? 'border border-[var(--warn)] bg-[var(--warn-bg)]' : ''}`} data-testid="hold-card">
      {o?.status === 'ON' ? (
        <>
          <p className="m-0 text-[15px] font-semibold text-[var(--warn)]">
            On hold since {dayWords(o.startedOn)} · {plural(o.days)} · {o.reason}
          </p>
          <p className={`m-0 ${muted}`}>
            Nothing on this project counts as late while it is on hold. When you take it off, the open steps, the stage under way and handover move {o.days ? plural(o.days) : 'the hold days'} later, on {customer}&rsquo;s side, never as our delay. {customer} sees &ldquo;on hold&rdquo; and the reason, never your note.
          </p>
          {o.note ? <p className={`m-0 ${muted}`}>Team note: {o.note}</p> : null}
          {view.canEnd ? (
            <div>
              <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => endHoldAction(view.projectId, o.id))}>
                Take off hold
              </button>
            </div>
          ) : null}
        </>
      ) : o?.status === 'ASKED' ? (
        <>
          <p className="m-0 text-[14.5px] font-semibold">
            Hold asked by {o.askedBy} on {dayWords(o.askedOn)}: {o.reason}
          </p>
          {o.note ? <p className={`m-0 ${muted}`}>Team note: {o.note}</p> : null}
          <p className={`m-0 ${muted}`}>{view.canApprove ? 'Approve it and the hold starts today.' : 'Waiting for the design head or the owner to approve. Until then the project runs as usual.'}</p>
          <div className="flex flex-wrap gap-2">
            {view.canApprove ? (
              <>
                <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => decideHoldAction(view.projectId, o.id, true))}>
                  Approve hold
                </button>
                <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => decideHoldAction(view.projectId, o.id, false))}>
                  Decline
                </button>
              </>
            ) : null}
            {view.canEnd ? (
              <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => withdrawHoldAction(view.projectId, o.id))}>
                Withdraw
              </button>
            ) : null}
          </div>
        </>
      ) : asking ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => askHoldAction(view.projectId, reason, note), () => setAsking(false));
          }}
        >
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0 text-[13.5px]">
            <legend className="mb-1 font-semibold">Why put it on hold?</legend>
            {view.reasons.map((r) => (
              <label key={r.key} className="flex items-center gap-2">
                <input type="radio" name="holdReason" value={r.key} checked={reason === r.key} onChange={() => setReason(r.key)} required /> {r.label}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-[13px]">
            For the team (optional; {customer} never sees it)
            <input className="fld" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <p className={`m-0 ${muted}`}>{view.canApprove ? 'You approve holds: it starts today.' : 'The design head or the owner approves it.'}</p>
          <div className="flex gap-2">
            <button type="submit" className="btn pri sm" disabled={pending}>
              {view.canApprove ? 'Put on hold' : 'Ask for a hold'}
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={muted}>
            {customer} not responding, needs time, or possession late? Put the project on hold: those days do not count as our delay.
            {view.past.length ? ` On hold before: ${view.past.map((p) => `${plural(p.days)} (${p.reason.toLowerCase()})`).join(', ')}.` : ''}
          </span>
          <button type="button" className="btn ghost sm" onClick={() => setAsking(true)}>
            {view.canApprove ? 'Put on hold' : 'Ask for a hold'}
          </button>
        </div>
      )}
      {message ? (
        <p role={message.ok ? 'status' : 'alert'} className={`m-0 text-[12.5px] ${message.ok ? 'text-[var(--good)]' : 'text-[var(--bad)]'}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
