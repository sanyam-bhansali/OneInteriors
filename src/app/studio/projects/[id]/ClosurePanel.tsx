'use client';

/**
 * The project closure (owner, 13 Oct 2026; docs/studio-os/PROJECT-LIFECYCLE.md):
 * the detailed final payment. The contract (design final, else the signed
 * total), the changes agreed on decisions, extra work for the client and
 * deductions / credits (description, quantity, rate or amount, a note), GST
 * on the net the quotation's way, what has been paid, and the final amount
 * due. "Save" keeps a version; "Close the project" fixes the final payment,
 * sends it to accounts and moves the project to snags. Every version is kept.
 */

import { useMemo, useState, useTransition } from 'react';
import { formatINR } from '@/lib/money';
import { checkClosureLines, closureTotals } from '@/modules/project/lifecycle-rules';
import type { ClosureView } from '@/modules/project/closure';
import { saveClosureAction } from './closure-actions';

interface Row {
  kind: 'EXTRA' | 'DEDUCTION';
  description: string;
  qty: string;
  rate: string;
  amount: string;
  note: string;
}

const blank = (kind: Row['kind'] = 'EXTRA'): Row => ({ kind, description: '', qty: '', rate: '', amount: '', note: '' });
const rupees = (p: number | null) => (p === null ? '' : String(p / 100));
const qtyText = (m: number | null) => (m === null ? '' : String(m / 1000));
const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`;

export function ClosurePanel({ view, customer }: { view: ClosureView; customer: string }) {
  const [rows, setRows] = useState<Row[]>(() =>
    view.latest?.lines.length
      ? view.latest.lines.map((l) => ({ kind: l.kind, description: l.description, qty: qtyText(l.qtyMilli), rate: rupees(l.ratePaise), amount: l.qtyMilli !== null && l.ratePaise !== null ? '' : rupees(l.amountPaise), note: l.note ?? '' }))
      : [blank()],
  );
  const [note, setNote] = useState(view.latest?.note ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const checked = useMemo(() => checkClosureLines(rows), [rows]);
  const totals = closureTotals({ ...view.base, lines: checked.ok ? checked.lines : [] });
  const fixed = view.closedOn !== null;
  const shown = fixed && view.latest ? view.latest.totals : totals;
  const edit = view.canEdit && !fixed;

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const save = (fix: boolean) => {
    if (fix && !window.confirm(`Close the project and fix the final payment at ${formatINR(totals.finalDuePaise)}? Accounts gets it and ${customer}'s project moves on to snags. This cannot be undone.`)) return;
    setMsg(null);
    start(async () => {
      const r = await saveClosureAction(view.projectId, { lines: rows, note, fix });
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });
  };

  return (
    <section aria-label="Project closure" className="card flex flex-col gap-4 p-5" data-testid="closure">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[17px]">Project closure</h2>
        {fixed ? (
          <span className="chip good">Closed out {view.closedOn} · final payment fixed</span>
        ) : view.phase === 'CLOSURE' ? (
          <span className="chip warn">Open{view.provisionalOn ? ` · provisional handover ${view.provisionalOn}` : ''}</span>
        ) : (
          <span className="chip">Opens at the provisional handover</span>
        )}
      </div>
      {view.noContract ? <p className="m-0 muted">This project was not signed in the app, so there are no payment stages to close against.</p> : null}

      <div className="tscroll">
        <table className="tbl" aria-label="Final account">
          <tbody>
            <tr>
              <td>Contract ({view.contractFrom === 'design-final' ? 'design final' : 'signed total'}, GST included)</td>
              <td className="mono text-right">{formatINR(shown.contractPaise)}</td>
            </tr>
            {shown.changesPaise !== 0 ? (
              <tr>
                <td>Changes agreed on {customer}&apos;s decisions</td>
                <td className="mono text-right">{formatINR(shown.changesPaise)}</td>
              </tr>
            ) : null}
            <tr>
              <td>Extra work for {customer}</td>
              <td className="mono text-right">{formatINR(shown.extrasPaise)}</td>
            </tr>
            <tr>
              <td>Deductions and credits</td>
              <td className="mono text-right">− {formatINR(shown.deductionsPaise)}</td>
            </tr>
            <tr>
              <td>GST on the net extra work ({pct(shown.gstBps)}, as the quotation)</td>
              <td className="mono text-right">{formatINR(shown.gstPaise)}</td>
            </tr>
            <tr>
              <td>
                <b>Total</b>
              </td>
              <td className="mono text-right">
                <b>{formatINR(shown.totalPaise)}</b>
              </td>
            </tr>
            <tr>
              <td>Paid so far (recorded payments){view.base.waitingPaise ? ` · ${formatINR(view.base.waitingPaise)} waiting for ${customer}'s yes` : ''}</td>
              <td className="mono text-right">− {formatINR(shown.paidPaise)}</td>
            </tr>
            <tr>
              <td>
                <b>{shown.finalDuePaise >= 0 ? 'Final amount due' : 'To refund to the client'}</b>
              </td>
              <td className="mono text-right" data-testid="final-due">
                <b>{formatINR(Math.abs(shown.finalDuePaise))}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-[15px]">Extra work and deductions</h3>
        {(fixed ? (view.latest?.lines ?? []).map((l) => ({ kind: l.kind, description: l.description, qty: qtyText(l.qtyMilli), rate: rupees(l.ratePaise), amount: rupees(l.amountPaise), note: l.note ?? '' })) : rows).map((r, i) => (
          <div key={i} className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]" data-testid="closure-line">
            <select className="fld" value={r.kind} disabled={!edit} onChange={(e) => set(i, { kind: e.target.value === 'DEDUCTION' ? 'DEDUCTION' : 'EXTRA' })} aria-label={`Line ${i + 1}: extra or deduction`}>
              <option value="EXTRA">Extra work</option>
              <option value="DEDUCTION">Deduction / credit</option>
            </select>
            <input className="fld" style={{ gridColumn: 'span 2' }} value={r.description} disabled={!edit} onChange={(e) => set(i, { description: e.target.value })} placeholder="What it is" aria-label={`Line ${i + 1}: description`} maxLength={200} />
            <input className="fld mono" inputMode="decimal" value={r.qty} disabled={!edit} onChange={(e) => set(i, { qty: e.target.value })} placeholder="Qty" aria-label={`Line ${i + 1}: quantity`} />
            <input className="fld mono" inputMode="decimal" value={r.rate} disabled={!edit} onChange={(e) => set(i, { rate: e.target.value })} placeholder="Rate ₹" aria-label={`Line ${i + 1}: rate in rupees`} />
            <input className="fld mono" inputMode="decimal" value={r.amount} disabled={!edit || (r.qty !== '' && r.rate !== '')} onChange={(e) => set(i, { amount: e.target.value })} placeholder="or amount ₹" aria-label={`Line ${i + 1}: amount in rupees`} />
            <input className="fld" style={{ gridColumn: 'span 2' }} value={r.note} disabled={!edit} onChange={(e) => set(i, { note: e.target.value })} placeholder="Note (optional)" aria-label={`Line ${i + 1}: note`} maxLength={200} />
            {edit ? (
              <button type="button" className="btn ghost sm" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, k) => k !== i) : [blank()]))} aria-label={`Remove line ${i + 1}`}>
                Remove
              </button>
            ) : null}
          </div>
        ))}
        {edit ? (
          <div className="hstack" style={{ gap: 8 }}>
            <button type="button" className="btn sec sm" onClick={() => setRows((rs) => [...rs, blank('EXTRA')])}>
              + Extra work
            </button>
            <button type="button" className="btn sec sm" onClick={() => setRows((rs) => [...rs, blank('DEDUCTION')])}>
              + Deduction or credit
            </button>
          </div>
        ) : null}
        {!checked.ok && edit ? <p className="m-0 bad-t sm">{checked.error}</p> : null}
      </div>

      {edit ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="lbl">Note for the team (not the client)</span>
            <textarea className="fld" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </label>
          <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn sec" disabled={pending || !checked.ok} onClick={() => save(false)}>
              Save
            </button>
            <button type="button" className="btn pri" disabled={pending || !checked.ok || view.noContract} onClick={() => save(true)} data-testid="close-project">
              Close the project · fix {formatINR(totals.finalDuePaise)}
            </button>
          </div>
        </>
      ) : null}
      {fixed ? (
        // TO BE SPECIFIED (owner): the accounts flow. For now accounts sees the final payment on the payments desk and records it there.
        <p className="m-0 muted sm">The final payment is with accounts on the payments desk. The project is in snags until {customer} signs off the handover.</p>
      ) : null}
      {msg ? (
        <p role="status" className={`m-0 ${msg.ok ? 'good-t' : 'bad-t'}`}>
          {msg.text}
        </p>
      ) : null}
      {view.history.length > 0 ? (
        <details>
          <summary className="muted sm">Every saved version ({view.history.length})</summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-[13.5px]">
            {view.history.map((h) => (
              <li key={h.version}>
                Version {h.version} · {h.savedOn} · <span className="mono">{formatINR(h.finalDuePaise)}</span>
                {h.final ? <span className="chip good ml-2">final</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
