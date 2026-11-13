'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ScopeSentView, ScopeView } from '@/modules/studio-scope/scope';
import { formatINR } from '@/lib/money';
import { rupeesIn, SCOPE_LINES_MAX, scopeImpactWords, scopeShortDay, type ScopeImpactName } from '@/modules/project/change-order-rules';
import { cancelScopeAction, sendScopeAction, sendSimpleScopeAction } from './scope-actions';

/**
 * Additional scope (owner, 13 Nov 2026): "Just a click: write the element,
 * write the cost, write the days, send for approval. That's all." "Like a
 * quotation: serial number, item, details, cost, then days it needs, and
 * send it for approval." "No discount on these. One line item costing, take
 * it or leave it." Each amount is what the client pays, GST included.
 *
 * Sent scope shows here at once as "Waiting for <client>"; approved, it is
 * due that day in Payments and the whole project is on hold until it is
 * paid. 12 Nov builder drafts still list below, to open or send.
 */

const muted = 'text-[12.5px] text-[var(--muted)]';

type Row = { item: string; details: string; amount: string };
const blank = (): Row => ({ item: '', details: '', amount: '' });

const IMPACTS: { key: ScopeImpactName; label: string }[] = [
  { key: 'MOVES_PROJECT', label: 'Moves the project' },
  { key: 'WITHIN_TIMELINE', label: 'Within the timeline' },
  { key: 'ITEM_ONLY', label: 'This item only' },
];

export function ScopeCard({ view, customer }: { view: ScopeView; customer: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [days, setDays] = useState<Record<string, string>>({});
  const [form, setForm] = useState(false);
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [impact, setImpact] = useState<ScopeImpactName | ''>('');
  const [moveDays, setMoveDays] = useState('');
  const [itemDate, setItemDate] = useState('');

  const canSend = view.canWrite && view.open.ok;
  if (!canSend && view.drafts.length === 0 && view.sent.length === 0) return null;

  const totalPaise = rows.reduce((a, r) => a + (rupeesIn(r.amount) ?? 0), 0);
  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const reset = () => {
    setRows([blank()]);
    setImpact('');
    setMoveDays('');
    setItemDate('');
    setForm(false);
  };

  return (
    <section aria-label="Additional scope" className="card flex flex-col gap-2 p-4" data-testid="scope-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14.5px] font-semibold">Additional scope</span>
        {canSend && !form ? (
          <button type="button" className="btn ghost sm" onClick={() => setForm(true)} data-testid="scope-open">
            + Additional scope
          </button>
        ) : null}
      </div>
      <p className={`m-0 ${muted}`}>
        Anything added after the design final: write each item, its cost and what it does to the timeline, and send it to {customer} for approval. Once approved it is due
        that day, and the project is on hold until it is paid.
      </p>

      {form ? (
        <form
          className="flex flex-col gap-3 rounded-[10px] border border-[var(--s-rule-soft)] p-3"
          data-testid="scope-form"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setMsg(null);
              const r = await sendSimpleScopeAction(view.projectId, { lines: rows, impact, days: moveDays, date: itemDate });
              if (r.ok) {
                setMsg({ ok: true, text: r.message ?? 'Sent.' });
                reset();
                router.refresh();
              } else setMsg({ ok: false, text: r.error });
            });
          }}
        >
          <div className="tscroll">
            <table className="tbl" aria-label="Additional scope items">
              <thead>
                <tr>
                  <th className="w-[36px]">#</th>
                  <th>Item</th>
                  <th>Details</th>
                  <th className="text-right">Cost (₹, with GST)</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="mono">{i + 1}</td>
                    <td>
                      <input className="fld w-full min-w-[140px]" aria-label={`Item ${i + 1}`} maxLength={120} value={r.item} onChange={(e) => setRow(i, { item: e.target.value })} placeholder="Loft in bedroom 2" />
                    </td>
                    <td>
                      <input className="fld w-full min-w-[160px]" aria-label={`Details ${i + 1}`} maxLength={600} value={r.details} onChange={(e) => setRow(i, { details: e.target.value })} placeholder="Size, finish" />
                    </td>
                    <td>
                      <input
                        className="fld w-[130px] text-right"
                        aria-label={`Cost ${i + 1}`}
                        inputMode="decimal"
                        value={r.amount}
                        onChange={(e) => setRow(i, { amount: e.target.value.replace(/[^0-9.,]/g, '') })}
                        placeholder="25000"
                      />
                    </td>
                    <td>
                      {rows.length > 1 ? (
                        <button type="button" className="btn ghost sm" aria-label={`Remove line ${i + 1}`} onClick={() => setRows(rows.filter((_, n) => n !== i))}>
                          ×
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td />
                  <td colSpan={2}>
                    <b>Total, with GST</b>
                  </td>
                  <td className="mono text-right">
                    <b>{formatINR(totalPaise)}</b>
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          {rows.length < SCOPE_LINES_MAX ? (
            <button type="button" className="btn ghost sm self-start" onClick={() => setRows([...rows, blank()])}>
              + Add a line
            </button>
          ) : null}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-semibold">What it does to the timeline</legend>
            <div className="flex flex-wrap gap-3">
              {IMPACTS.map((o) => (
                <label key={o.key} className="flex items-center gap-1.5 text-[13px]">
                  <input type="radio" name="scope-impact" value={o.key} checked={impact === o.key} onChange={() => setImpact(o.key)} required />
                  {o.label}
                </label>
              ))}
            </div>
            {impact === 'MOVES_PROJECT' ? (
              <label className="flex flex-col gap-1 text-[13px]">
                Days it moves the project
                <input className="fld w-[110px]" inputMode="numeric" required value={moveDays} onChange={(e) => setMoveDays(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 7" />
              </label>
            ) : null}
            {impact === 'ITEM_ONLY' ? (
              <label className="flex flex-col gap-1 text-[13px]">
                This item comes by
                <input className="fld w-[170px]" type="date" required min={view.today} value={itemDate} onChange={(e) => setItemDate(e.target.value)} />
              </label>
            ) : null}
            {impact ? <span className={muted}>{customer} sees: &ldquo;{preview(impact, moveDays, itemDate)}&rdquo;</span> : null}
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn pri sm" disabled={pending || totalPaise <= 0 || !impact} data-testid="scope-send">
              Send to {customer} for approval
            </button>
            <button type="button" className="btn ghost sm" disabled={pending} onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {view.sent.map((s) => (
        <SentScope key={s.id} s={s} customer={customer} today={view.today} canWrite={view.canWrite} projectId={view.projectId} onMsg={setMsg} />
      ))}

      {view.drafts.map((d) => (
        <form
          key={d.id}
          className="flex flex-wrap items-end gap-2 rounded-[10px] border border-[var(--s-rule-soft)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setMsg(null);
              const r = await sendScopeAction(view.projectId, d.id, days[d.id] ?? '');
              setMsg(r.ok ? { ok: true, text: r.message ?? 'Sent.' } : { ok: false, text: r.error });
            });
          }}
        >
          <span className="flex min-w-[200px] flex-1 flex-col">
            <b className="text-[14px]">{d.number}</b>
            <span className={muted}>
              {d.lines} item{d.lines === 1 ? '' : 's'} · {formatINR(d.totalPaise)} with GST · made in the quotation builder ·{' '}
              <Link href={`/studio/quotations/${d.id}`} className="acc-t">
                Open it
              </Link>
            </span>
          </span>
          {view.canWrite ? (
            <>
              <label className="flex flex-col gap-1 text-[13px]">
                Days it moves the project
                <input className="fld w-[110px]" inputMode="numeric" required value={days[d.id] ?? ''} onChange={(e) => setDays({ ...days, [d.id]: e.target.value.replace(/[^0-9]/g, '') })} placeholder="e.g. 7" />
              </label>
              <button type="submit" className="btn pri sm" disabled={pending || d.lines === 0}>
                Send to {customer} for approval
              </button>
            </>
          ) : null}
        </form>
      ))}
      {msg ? (
        <p role={msg.ok ? 'status' : 'alert'} className={`m-0 text-[12.5px] ${msg.ok ? 'text-[var(--good)]' : 'text-[var(--bad)]'}`}>
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}

/** What the client will read, as the form stands. */
function preview(impact: ScopeImpactName, days: string, date: string): string {
  if (impact === 'MOVES_PROJECT') return scopeImpactWords({ kind: 'MOVES_PROJECT', days: Number(days) || 0 });
  if (impact === 'ITEM_ONLY') return date ? scopeImpactWords({ kind: 'ITEM_ONLY', on: date }) : 'This item comes by …';
  return scopeImpactWords({ kind: 'WITHIN_TIMELINE' });
}

function statusLine(s: ScopeSentView, customer: string, today: string): string {
  if (s.status === 'SENT_TO_CLIENT') return `Waiting for ${customer}`;
  if (s.status === 'APPROVED') {
    const owed = Math.max(0, s.totalPaise - s.recordedPaise);
    const due = !s.dueOn || s.dueOn === today ? 'due today' : `due since ${scopeShortDay(s.dueOn)}`;
    return `Approved · ${formatINR(owed)} ${due} · the project is on hold until it is paid`;
  }
  if (s.status === 'DECLINED') return `${customer} declined${s.declineReason ? `: “${s.declineReason}”` : ''}`;
  if (s.status === 'PAID' || s.status === 'RELEASED') return 'Paid';
  return s.status;
}

function SentScope({
  s,
  customer,
  today,
  canWrite,
  projectId,
  onMsg,
}: {
  s: ScopeSentView;
  customer: string;
  today: string;
  canWrite: boolean;
  projectId: string;
  onMsg: (m: { ok: boolean; text: string } | null) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <article className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--s-rule-soft)] p-3" data-testid="scope-sent" data-status={s.status}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <b className="text-[14px]">{s.title}</b>
        <b className="mono">{formatINR(s.totalPaise)}</b>
      </div>
      <span className={`text-[12.5px] ${s.status === 'APPROVED' ? 'font-semibold' : ''}`}>{statusLine(s, customer, today)}</span>
      <ol className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
        {s.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>
              {i + 1}. {l.item}
              {l.details ? <span className="text-[var(--muted)]"> · {l.details}</span> : null}
            </span>
            <span className="mono">{formatINR(l.amountPaise)}</span>
          </li>
        ))}
      </ol>
      <span className={muted}>
        {customer} reads: &ldquo;{scopeImpactWords(s.impact)}&rdquo;
        {s.inclGst ? ' · amounts include GST' : ''}
      </span>
      {canWrite && s.status === 'SENT_TO_CLIENT' ? (
        <button
          type="button"
          className="btn ghost sm self-start"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Take back ${s.title}? ${customer} will no longer see it.`)) return;
            start(async () => {
              onMsg(null);
              const r = await cancelScopeAction(projectId, s.id);
              onMsg(r.ok ? { ok: true, text: 'Taken back.' } : { ok: false, text: r.error });
              if (r.ok) router.refresh();
            });
          }}
        >
          Take back
        </button>
      ) : null}
    </article>
  );
}
