'use client';

import { useActionState } from 'react';
import { saveCapacityAction, type CapacityState } from './actions';

const INITIAL: CapacityState = { status: 'idle' };

/**
 * How many projects a month this studio will take.
 *
 * The only number on the studio surface that changes what we do rather than
 * what we show: at capacity, the allocator stops putting them in front of
 * customers. Which is why it has to be next to the listing rather than buried
 * on an analytics page — it is a setting, not a statistic.
 */
export function CapacityForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState(saveCapacityAction, INITIAL);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="capacityPerMonth" className="label m-0 mb-2 block">
          Projects a month
        </label>
        <input
          id="capacityPerMonth"
          name="capacityPerMonth"
          type="number"
          min={0}
          max={60}
          defaultValue={current ?? undefined}
          placeholder="e.g. 4"
          className="w-[8rem] rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-2.5 text-[15px] tabular-nums"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[var(--color-petrol)] px-6 py-2.5 text-[15px] font-medium text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)] disabled:opacity-40"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>

      <p aria-live="polite" className="m-0 text-[13.5px] text-[var(--color-ink-2)]">
        {state.status === 'saved' ? 'Saved.' : null}
        {state.status === 'error' ? (
          <span className="text-[var(--color-atrisk)]">{state.error}</span>
        ) : null}
      </p>
    </form>
  );
}
