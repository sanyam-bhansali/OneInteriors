'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ScopeView } from '@/modules/studio-scope/scope';
import { formatINR } from '@/lib/money';
import { sendScopeAction, startScopeAction } from './scope-actions';

/**
 * Additional scope (owner, 12 Nov 2026): after the design final quotation,
 * a new quotation for only the new items; the days the work needs; sent to
 * the client for approval with its payment due today. Once approved the
 * project is on hold until the payment is recorded.
 */

const muted = 'text-[12.5px] text-[var(--muted)]';

export function ScopeCard({ view, customer }: { view: ScopeView; customer: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [days, setDays] = useState<Record<string, string>>({});
  if (!view.canWrite && view.drafts.length === 0) return null;
  if (!view.open.ok && view.drafts.length === 0) return null;
  return (
    <section aria-label="Additional scope" className="card flex flex-col gap-2 p-4" data-testid="scope-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14.5px] font-semibold">Additional scope</span>
        {view.canWrite && view.open.ok ? (
          <button
            type="button"
            className="btn ghost sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMsg(null);
                const r = await startScopeAction(view.projectId);
                if (r.ok && r.id) router.push(`/studio/quotations/${r.id}`);
                else if (!r.ok) setMsg({ ok: false, text: r.error });
              })
            }
          >
            + Additional scope
          </button>
        ) : null}
      </div>
      <p className={`m-0 ${muted}`}>
        Anything added after the design final: a new quotation with only the new items. {customer} approves it in the app with the days it needs; its payment is due at once,
        and the project is on hold until it is paid. Then the plan moves by the days on hold plus the days it needs, on {customer}&rsquo;s side.
      </p>
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
              {d.lines} item{d.lines === 1 ? '' : 's'} · {formatINR(d.totalPaise)} with GST ·{' '}
              <Link href={`/studio/quotations/${d.id}`} className="acc-t">
                Open in the quotation builder
              </Link>
            </span>
          </span>
          {view.canWrite ? (
            <>
              <label className="flex flex-col gap-1 text-[13px]">
                Days it needs
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
