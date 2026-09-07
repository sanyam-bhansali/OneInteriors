'use client';

import { useActionState, useState } from 'react';
import { setStatusAction } from './actions';
import type { StudioStatus } from '@/modules/studio/types';
import type { RecordResult } from '@/modules/verification/record';

const OPTIONS: Array<{ value: StudioStatus; label: string; help: string }> = [
  { value: 'ONBOARDING', label: 'Onboarding', help: 'Not yet shown to customers.' },
  { value: 'ACTIVE', label: 'Active', help: 'Shown and matchable.' },
  { value: 'PAUSED', label: 'Paused', help: 'Their choice — not taking leads right now.' },
  { value: 'SUSPENDED', label: 'Suspended', help: 'Our action while a dispute is investigated. Appealable.' },
  { value: 'REMOVED', label: 'Removed', help: 'Permanent. Misrepresentation, a pattern of upheld disputes, or a refused re-audit.' },
];

/**
 * Status is the lever, not the tier.
 *
 * There is deliberately no control anywhere in this console for setting a
 * verification tier — it is computed from the checks. If a studio needs to stop
 * appearing, that is a status change, and it demands a written reason because
 * /verification promises studios an appeal decided by someone who did not make
 * the original call. That person needs something to read.
 */
export function StatusControl({
  studioId,
  slug,
  status,
}: {
  studioId: string;
  slug: string;
  status: StudioStatus;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<RecordResult | null, FormData>(
    async (prev, fd) => {
      const r = await setStatusAction(prev, fd);
      if (r.ok) setOpen(false);
      return r;
    },
    null,
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="label m-0">Status</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="rounded-full border border-[var(--color-rule)] px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-2)] hover:border-[var(--color-petrol)]"
        >
          {open ? 'Cancel' : 'Change'}
        </button>
      </div>
      <p className="m-0 mt-1 text-[14px] text-[var(--color-ink)]">{status}</p>

      {open ? (
        <form action={action} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="studioId" value={studioId} />
          <input type="hidden" name="slug" value={slug} />

          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">New status</legend>
            <div className="flex flex-col gap-1.5">
              {OPTIONS.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-start gap-2 text-[13px]">
                  <input
                    type="radio"
                    name="status"
                    value={o.value}
                    defaultChecked={o.value === status}
                    required
                    className="mt-0.5 accent-[var(--color-petrol)]"
                  />
                  <span>
                    <span className="text-[var(--color-ink)]">{o.label}</span>
                    <span className="block text-[11.5px] leading-snug text-[var(--color-ink-3)]">
                      {o.help}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="status-reason" className="label m-0 mb-1.5 block">
              Reason — the studio can appeal this
            </label>
            <textarea
              id="status-reason"
              name="reason"
              required
              minLength={10}
              rows={3}
              placeholder="Two upheld disputes in four months; site inspection refused on 3 Sep."
              className="w-full rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-[13.5px]"
            />
          </div>

          {state && !state.ok ? (
            <p role="alert" className="m-0 text-[13px] text-[var(--color-atrisk)]">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-[var(--color-petrol)] px-4 py-2 text-[13.5px] font-medium text-[var(--color-paper)] disabled:opacity-40"
          >
            {pending ? 'Saving…' : 'Change status'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
