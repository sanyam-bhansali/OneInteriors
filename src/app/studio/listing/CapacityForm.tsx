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
    <form action={action} className="hstack" style={{ alignItems: 'flex-end' }}>
      <div className="ox-f">
        <label htmlFor="capacityPerMonth" className="lbl">
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
          className="fld fit num"
          style={{ width: '8rem' }}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn pri"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>

      <p aria-live="polite" className="muted sm" style={{ margin: 0 }}>
        {state.status === 'saved' ? 'Saved.' : null}
        {state.status === 'error' ? (
          <span className="bad-t">{state.error}</span>
        ) : null}
      </p>
    </form>
  );
}
