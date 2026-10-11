'use client';

/**
 * Sending, revisions and the sales final, on the quotation (Studio OS
 * Phase 1, docs/studio-os/PHASE-1-SALES.md §3).
 *
 * - Every send is a frozen revision: R1, R2, R3. When the quotation has
 *   changed since the last one went out, "Send this version" keeps R(n+1).
 * - Any two revisions can be compared.
 * - The salesperson marks one revision as the sales final, with the payment
 *   stages agreed for this client (the studio's, editable here first).
 *   Marking a later one moves the mark; the lead's history says so.
 */

import Link from 'next/link';
import { useState } from 'react';
import { formatINR } from '@/lib/money';
import type { QuoteSalesView } from '@/modules/studio-sales/revisions';
import type { PaymentStage } from '@/modules/studio-sales/payment-template';
import { markSalesFinalAction, sendAgainAction } from '../../sales-actions';
import { Said, useAct, inputClass, primaryClass, quietClass } from '../../SalesUi';
import { PaymentStagesEditor } from '../../PaymentStagesEditor';

const when = (d: Date | string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function Revisions({ view, leadHref, mayBook }: { view: QuoteSalesView; leadHref: string | null; mayBook: boolean }) {
  const send = useAct();
  const last = view.revisions[view.revisions.length - 1] ?? null;
  const [a, setA] = useState(view.revisions.length >= 2 ? view.revisions[view.revisions.length - 2]!.n : (last?.n ?? 1));
  const [b, setB] = useState(last?.n ?? 1);

  if (view.revisions.length === 0) {
    return (
      <section id="revisions" className="s-card mb-4 scroll-mt-20 px-4 py-3.5">
        <h2 className="m-0 text-[15px] font-semibold">Revisions</h2>
        <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-[var(--s-ink-2)]">
          When you send this quotation (Mark as sent), the copy the client has is kept as R1. Each time you send a changed version, it becomes R2, R3…
        </p>
      </section>
    );
  }

  return (
    <section id="revisions" className="s-card mb-4 scroll-mt-20 px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[15px] font-semibold">Revisions sent</h2>
        {view.status === 'ISSUED' && view.changedSinceSent ? (
          <button type="button" disabled={send.pending} onClick={() => send.run(() => sendAgainAction(view.quoteId))} className={primaryClass}>
            {send.pending ? 'Saving…' : `Send this version as R${(last?.n ?? 0) + 1}`}
          </button>
        ) : null}
      </div>
      {view.status === 'ISSUED' && view.changedSinceSent ? (
        <p className="m-0 mt-1 text-[12.5px] text-[var(--s-ink-3)]">You changed it since {last ? `R${last.n}` : 'it was sent'}. Press this when you send the new version to the client.</p>
      ) : null}
      <Said result={send.result} />

      <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
        {view.revisions.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[9px] bg-[var(--s-surface-2)] px-3 py-2 text-[13.5px]">
            <span className="s-num font-semibold">{r.label}</span>
            <span className="text-[var(--s-ink-2)]">
              sent {when(r.sentAt)}
              {r.sentByName ? ` by ${r.sentByName}` : ''} · {r.lineCount} lines
            </span>
            {r.isSalesFinal ? <span className="s-tag !bg-[var(--s-good-wash)] !text-[var(--s-good)]">Sales final</span> : null}
            <span className="s-num ml-auto font-semibold">{formatINR(r.totalPaise)}</span>
          </li>
        ))}
      </ul>

      {view.revisions.length >= 2 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-[var(--s-ink-2)]">Compare</span>
          <select aria-label="First revision" value={a} onChange={(e) => setA(Number(e.target.value))} className={`${inputClass} w-auto py-1.5 text-[13px]`}>
            {view.revisions.map((r) => (
              <option key={r.n} value={r.n}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="text-[var(--s-ink-2)]">with</span>
          <select aria-label="Second revision" value={b} onChange={(e) => setB(Number(e.target.value))} className={`${inputClass} w-auto py-1.5 text-[13px]`}>
            {view.revisions.map((r) => (
              <option key={r.n} value={r.n}>
                {r.label}
              </option>
            ))}
          </select>
          <Link href={`/studio/quotations/${view.quoteId}/compare?a=${a}&b=${b}`} className={quietClass} aria-disabled={a === b}>
            Show what changed
          </Link>
        </div>
      ) : null}

      {view.stage === 'SALES' && !view.fromOneInteriors ? (
        <SalesFinal view={view} leadHref={leadHref} mayBook={mayBook} />
      ) : null}
    </section>
  );
}

function SalesFinal({ view, leadHref, mayBook }: { view: QuoteSalesView; leadHref: string | null; mayBook: boolean }) {
  const last = view.revisions[view.revisions.length - 1]!;
  const current = view.salesFinal;
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(last.n);
  const [stages, setStages] = useState<PaymentStage[]>(current?.schedule ?? view.template);
  const { pending, result, run } = useAct();
  const chosen = view.revisions.find((r) => r.n === n);
  const booked = view.projectId !== null;

  return (
    <div className="mt-4 border-t border-[var(--s-rule-soft)] pt-3">
      {current ? (
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-[14px]">
            <span className="font-semibold">Sales final: R{current.n}</span>{' '}
            <span className="text-[var(--s-ink-2)]">· {formatINR(current.totalPaise)}</span>
          </p>
          {current.amounts ? (
            <ol className="m-0 flex list-none flex-col gap-0.5 p-0 text-[13px] text-[var(--s-ink-2)]">
              {current.amounts.map((s, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {s.label}
                    {s.note ? <span className="text-[var(--s-ink-3)]"> — {s.note}</span> : null}
                  </span>
                  <span className="s-num">{formatINR(s.amountPaise)}</span>
                </li>
              ))}
            </ol>
          ) : null}
          {!current.linesUnchanged && !booked ? (
            <p className="m-0 text-[12.5px] text-[var(--s-bad)]">The quotation has changed since R{current.n}. Send the new version and mark it, or undo the change, before the booking.</p>
          ) : null}
          {booked ? (
            <p className="m-0 text-[13px] text-[var(--s-good)]">Booked. The project is running on this sales final.</p>
          ) : leadHref && mayBook ? (
            <Link href={`${leadHref}#booking`} className={`${primaryClass} mt-1 self-start`}>
              Record booking
            </Link>
          ) : (
            <p className="m-0 text-[12.5px] text-[var(--s-ink-3)]">Accounts records the booking advance against it.</p>
          )}
        </div>
      ) : (
        <p className="m-0 text-[13.5px] text-[var(--s-ink-2)]">No sales final yet. When the client agrees, mark the revision they agreed to.</p>
      )}

      {!booked && view.mayMark ? (
        open ? (
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="s-label">Which revision did the client agree to?</span>
              <select value={n} onChange={(e) => setN(Number(e.target.value))} className={`${inputClass} w-auto`}>
                {view.revisions.map((r) => (
                  <option key={r.n} value={r.n}>
                    {r.label} · {formatINR(r.totalPaise)}
                  </option>
                ))}
              </select>
            </label>
            <p className="m-0 text-[13px] text-[var(--s-ink-2)]">Payment stages for this client — change them here if you agreed something different:</p>
            <PaymentStagesEditor stages={stages} onChange={setStages} totalPaise={chosen?.totalPaise ?? null} />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => run(() => markSalesFinalAction(view.quoteId, n, stages, view.clientId), (r) => r.ok && setOpen(false))} className={primaryClass}>
                {pending ? 'Saving…' : `Mark R${n} as sales final`}
              </button>
              <button type="button" onClick={() => setOpen(false)} className={quietClass}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className={`${current ? quietClass : primaryClass} mt-3`}>
            {current ? (current.n === last.n ? 'Change the payment stages' : `Mark a later revision instead`) : 'Mark as sales final'}
          </button>
        )
      ) : null}
      <Said result={result} />
    </div>
  );
}
