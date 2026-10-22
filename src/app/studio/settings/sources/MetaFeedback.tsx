'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ConversionScreen } from '@/modules/studio-sales/conversions';
import { CAPI_EVENTS } from '@/modules/studio-intake/capi-rules';
import { saveMetaFeedbackAction } from './routing-actions';
import { Said, useAct } from '../../SalesUi';

/**
 * Settings → Lead sources, "Tell Meta which leads turned into customers"
 * (owner, 22 Oct 2026; studio-sales/conversions.ts). Off until the owner
 * switches it on, and only possible once One Interiors has the studio's Meta
 * dataset and token (STUDIO_META_CAPI). Only leads that came from a Meta lead
 * ad are ever reported; nothing goes to the customer.
 */

const STATUS_WORDS: Record<string, string> = {
  QUEUED: 'Waiting to send',
  SENT: 'Sent',
  FAILED: 'Did not go through',
  SKIPPED: 'Not sent',
};

export function MetaFeedback({ screen }: { screen: ConversionScreen }) {
  const [enabled, setEnabled] = useState(screen.enabled);
  const [stages, setStages] = useState<Record<string, string>>(() => Object.fromEntries(screen.stages.map((s) => [s.id, s.event ?? ''])));
  const { pending, result, run } = useAct();
  const open = screen.stages.filter((s) => s.kind !== 'LOST');

  return (
    <section className="card flex flex-col gap-3 p-5">
      <div>
        <h2 className="m-0 text-[16px] font-semibold">Tell Meta which leads turned into customers</h2>
        <p className="m-0 mt-1 text-[13.5px] leading-relaxed muted">
          When a lead from your Facebook or Instagram lead ads reaches a column you choose, Meta is told (once per lead), so it shows your ads to more people like the ones who became customers. Only leads that came from a Meta lead ad; the phone and email are scrambled (hashed) before they leave. Nothing is sent to the customer.
        </p>
      </div>

      {!screen.ready ? (
        <p className="m-0 rounded-[9px] bg-[var(--s-surface-2)] p-3 text-[13px]">
          Not set up yet: One Interiors needs your Meta dataset ID and a Conversions API token for your studio. Until then this stays off and nothing is sent.
        </p>
      ) : null}

      {screen.canManage ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveMetaFeedbackAction(enabled, stages));
          }}
        >
          <label className="flex items-center gap-2 text-[13.5px]">
            <input type="checkbox" checked={enabled} disabled={!screen.ready && !enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Tell Meta
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Which column tells Meta what</span>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13.5px]">
              {open.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[10rem]">{s.name}</span>
                  <select aria-label={`What reaching ${s.name} tells Meta`} value={stages[s.id] ?? ''} onChange={(e) => setStages((m) => ({ ...m, [s.id]: e.target.value }))} className="fld w-auto">
                    <option value="">Nothing</option>
                    {CAPI_EVENTS.map((ev) => (
                      <option key={ev.name} value={ev.name}>
                        {ev.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <p className="m-0 text-[12.5px] muted">A booked or handed-over column says &ldquo;Customer&rdquo; unless you change it. Mark the column where a lead is genuinely interested (an effective lead, a meeting booked) as &ldquo;Qualified lead&rdquo;. Calling steps are best left at Nothing.</p>
          </div>
          <div>
            <button type="submit" disabled={pending} className="btn pri sm">
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
          <Said result={result} />
        </form>
      ) : (
        <p className="m-0 text-[13px] muted">The studio owner decides this. It is {screen.enabled ? 'on' : 'off'}.</p>
      )}

      {screen.recent.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium">
            Last sent to Meta · {screen.sent} sent{screen.failed > 0 ? ` · ${screen.failed} did not go through (tried again each night)` : ''}
          </span>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12.5px]">
            {screen.recent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="muted">{e.atLabel}</span>
                <Link href={`/studio/clients/${e.clientId}`} className="underline">
                  {e.clientName}
                </Link>
                <span>{e.eventName}</span>
                <span className={e.status === 'FAILED' ? 'text-[var(--s-bad)]' : e.status === 'SENT' ? 'text-[var(--s-good)]' : 'muted'}>{STATUS_WORDS[e.status] ?? e.status}</span>
                {e.lastError && e.status !== 'SENT' ? <span className="muted">{e.lastError}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
