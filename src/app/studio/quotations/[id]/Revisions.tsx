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
import { LineIcon } from '../../ui/icons';
import { useState } from 'react';
import { formatINR } from '@/lib/money';
import type { QuoteSalesView } from '@/modules/studio-sales/revisions';
import type { PaymentStage } from '@/modules/studio-sales/payment-template';
import { markSalesFinalAction, sendAgainAction } from '../../sales-actions';
import { Said, useAct } from '../../SalesUi';
import { PaymentStagesEditor } from '../../PaymentStagesEditor';
import { SalesVoice } from './SalesVoice';

const when = (d: Date | string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function Revisions({ view, leadHref, mayBook }: { view: QuoteSalesView; leadHref: string | null; mayBook: boolean }) {
  const send = useAct();
  const last = view.revisions[view.revisions.length - 1] ?? null;
  const [a, setA] = useState(view.revisions.length >= 2 ? view.revisions[view.revisions.length - 2]!.n : (last?.n ?? 1));
  const [b, setB] = useState(last?.n ?? 1);

  if (view.revisions.length === 0) {
    return (
      <section id="revisions" className="card" style={{ scrollMarginTop: 80 }}>
        <div className="chead">
          <h2>Revisions</h2>
          <span className="chip">None sent yet</span>
        </div>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          When you send this quotation (Mark as sent), the copy the client has is kept as R1. Each time you send a changed version, it becomes R2, R3…
        </p>
      </section>
    );
  }

  return (
    <section id="revisions" className="card" style={{ scrollMarginTop: 80 }}>
      <div className="chead">
        <h2>Revisions sent</h2>
        {view.status === 'ISSUED' && view.changedSinceSent ? (
          <button type="button" disabled={send.pending} onClick={() => send.run(() => sendAgainAction(view.quoteId))} className="btn pri sm">
            {send.pending ? 'Saving…' : `Send this version as R${(last?.n ?? 0) + 1}`}
          </button>
        ) : null}
      </div>
      {view.status === 'ISSUED' && view.changedSinceSent ? (
        <p className="muted sm" style={{ margin: 0 }}>You changed it since {last ? `R${last.n}` : 'it was sent'}. Press this when you send the new version to the client.</p>
      ) : null}
      <Said result={send.result} />

      <ul className="revlist">
        {view.revisions.map((r) => (
          <li key={r.id} className="revrow">
            <span className="mono" style={{ fontWeight: 600 }}>{r.label}</span>
            <span className="muted">
              sent {when(r.sentAt)}
              {r.sentByName ? ` by ${r.sentByName}` : ''} · {r.lineCount} lines
            </span>
            {r.isSalesFinal ? (
              <span className="chip good">
                <span className="dot" />
                Sales final
              </span>
            ) : null}
            <span className="mono" style={{ marginLeft: 'auto', fontWeight: 600 }}>{formatINR(r.totalPaise)}</span>
          </li>
        ))}
      </ul>

      {view.revisions.length >= 2 ? (
        <div className="hstack sm" style={{ gap: 8 }}>
          <span className="muted">Compare</span>
          <select aria-label="First revision" value={a} onChange={(e) => setA(Number(e.target.value))} className="fld" style={{ width: 'auto', minHeight: 34 }}>
            {view.revisions.map((r) => (
              <option key={r.n} value={r.n}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="muted">with</span>
          <select aria-label="Second revision" value={b} onChange={(e) => setB(Number(e.target.value))} className="fld" style={{ width: 'auto', minHeight: 34 }}>
            {view.revisions.map((r) => (
              <option key={r.n} value={r.n}>
                {r.label}
              </option>
            ))}
          </select>
          <Link href={`/studio/quotations/${view.quoteId}/compare?a=${a}&b=${b}`} className="btn sec sm" aria-disabled={a === b}>
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
  /* Notes for the design team, required; a voice note kept as audio (DESIGN-PROCESS-PLAN.md §4.2). */
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [voicePath, setVoicePath] = useState<string | null>(null);
  const { pending, result, run } = useAct();
  const chosen = view.revisions.find((r) => r.n === n);
  const booked = view.projectId !== null;

  return (
    <div className="qsplit">
      {current ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0 }}>
            <b style={{ fontWeight: 600 }}>Sales final: R{current.n}</b>{' '}
            <span className="muted">
              · <span className="mono">{formatINR(current.totalPaise)}</span>
            </span>
          </p>
          {current.amounts ? (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {current.amounts.map((s, i) => (
                <li key={i} className="sumrow sm">
                  <span>
                    {s.label}
                    {s.note ? <span className="muted"> — {s.note}</span> : null}
                  </span>
                  <span className="mono">{formatINR(s.amountPaise)}</span>
                </li>
              ))}
            </ol>
          ) : null}
          {current.notes || current.voiceUrl ? (
            <div className="sm" style={{ borderLeft: '2px solid var(--ring)', paddingLeft: 10 }}>
              <span className="lbl">Notes for the design team</span>
              {current.notes ? <p style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>{current.notes}</p> : null}
              {current.voiceUrl ? <audio controls src={current.voiceUrl} style={{ height: 32, marginTop: 4 }} /> : null}
            </div>
          ) : null}
          {!current.linesUnchanged && !booked ? (
            <p className="qerr">The quotation has changed since R{current.n}. Send the new version and mark it, or undo the change, before the booking.</p>
          ) : null}
          {booked ? (
            <p className="qok">
              <LineIcon name="lock" size={14} /> Booked. The project is running on this sales final.</p>
          ) : leadHref && mayBook ? (
            <Link href={`${leadHref}#booking`} className="btn acc sm" style={{ alignSelf: 'flex-start' }}>
              Record booking
            </Link>
          ) : (
            <p className="muted sm" style={{ margin: 0 }}>Accounts records the booking advance against it.</p>
          )}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>No sales final yet. When the client agrees, mark the revision they agreed to.</p>
      )}

      {!booked && view.mayMark ? (
        open ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label className="qfield">
              <span className="lbl">Which revision did the client agree to?</span>
              <select value={n} onChange={(e) => setN(Number(e.target.value))} className="fld" style={{ width: 'auto', alignSelf: 'flex-start' }}>
                {view.revisions.map((r) => (
                  <option key={r.n} value={r.n}>
                    {r.label} · {formatINR(r.totalPaise)}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted sm" style={{ margin: 0 }}>Payment stages for this client — change them here if you agreed something different:</p>
            <PaymentStagesEditor stages={stages} onChange={setStages} totalPaise={chosen?.totalPaise ?? null} />
            <label className="qfield">
              <span className="lbl">Notes for the design team (required)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                maxLength={3000}
                className="fld"
                placeholder="What the client wants, the budget, what was promised. E.g. budget 3 lakh, consider Luxe laminates; a study in bedroom 2."
              />
            </label>
            <SalesVoice quoteId={view.quoteId} onPath={setVoicePath} />
            <div className="hstack">
              <button
                type="button"
                disabled={pending || notes.trim().length < 10}
                onClick={() => run(() => markSalesFinalAction(view.quoteId, n, stages, view.clientId, { notes, voicePath }), (r) => r.ok && setOpen(false))}
                className="btn pri"
              >
                {pending ? 'Saving…' : `Mark R${n} as sales final`}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn ghost">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className={current ? 'btn sec sm' : 'btn pri sm'} style={{ alignSelf: 'flex-start' }}>
            {current ? (current.n === last.n ? 'Change the payment stages' : `Mark a later revision instead`) : 'Mark as sales final'}
          </button>
        )
      ) : null}
      <Said result={result} />
    </div>
  );
}
