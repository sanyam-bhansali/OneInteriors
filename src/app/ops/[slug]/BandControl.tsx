'use client';

import { useActionState } from 'react';
import { confirmBandAction } from './actions';
import { TIER, TIERS, type Tier } from '@/modules/quotation/tiers';

/**
 * The band, proposed from the studio's prices and confirmed by a person.
 *
 * The proposal and its reasoning sit above the choice, and the proposed band
 * is preselected — but nothing is stored until somebody presses Confirm,
 * because a band decides which customers this studio ever meets.
 */
export function BandControl({
  studioId,
  slug,
  current,
  proposed,
  note,
  disagree,
}: {
  studioId: string;
  slug: string;
  current: Tier | null;
  proposed: Tier | null;
  note: string;
  disagree: boolean;
}) {
  const [state, action, pending] = useActionState(confirmBandAction, null);

  return (
    <form action={action} className="mt-4 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-4">
      <input type="hidden" name="studioId" value={studioId} />
      <input type="hidden" name="slug" value={slug} />
      <p className="label m-0 mb-1.5">
        Band {current ? `— confirmed ${TIER[current].label}` : '— not confirmed'}
      </p>
      <p
        className={`m-0 mb-3 text-[13.5px] leading-relaxed ${
          disagree ? 'border-l-2 border-[var(--color-brass)] pl-3 text-[var(--color-ink)]' : 'text-[var(--color-ink-2)]'
        }`}
      >
        {note}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <select
          name="band"
          defaultValue={current ?? proposed ?? ''}
          className="rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2.5 text-[14px]"
        >
          <option value="">Not confirmed</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER[t].label}
              {t === proposed ? ' (proposed)' : ''}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[var(--color-petrol)] px-5 py-2.5 text-[14px] text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)] disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Confirm'}
        </button>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="m-0 mt-2 text-[13.5px] text-[var(--color-atrisk)]">{state.error}</p>
      ) : null}
      {state?.ok ? <p className="m-0 mt-2 text-[13.5px] text-[var(--color-ontrack)]">Saved.</p> : null}
    </form>
  );
}
