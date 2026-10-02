'use client';

import { useActionState } from 'react';
import { addHoursAction, blockDayAction, type HoursState } from './actions';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const INITIAL: HoursState = {};
const input =
  'rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-[14px]';
const button =
  'rounded-full bg-[var(--color-petrol)] px-4 py-2 text-[13.5px] text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)] disabled:opacity-40';

export function AddHoursForm({ expertUserId }: { expertUserId: string }) {
  const [state, action, pending] = useActionState(addHoursAction, INITIAL);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="expertUserId" value={expertUserId} />
      <select name="weekday" defaultValue="1" className={input} aria-label="Day">
        {DAYS.map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </select>
      <input name="start" placeholder="11:00" className={`${input} w-20`} aria-label="From" />
      <span className="pb-2 text-[13px] text-[var(--color-ink-3)]">to</span>
      <input name="end" placeholder="13:00" className={`${input} w-20`} aria-label="To" />
      <button type="submit" disabled={pending} className={button}>
        Add hours
      </button>
      {state.error ? <p className="m-0 basis-full text-[13px] text-[var(--color-atrisk)]">{state.error}</p> : null}
    </form>
  );
}

export function BlockDayForm({ expertUserId }: { expertUserId: string }) {
  const [state, action, pending] = useActionState(blockDayAction, INITIAL);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="expertUserId" value={expertUserId} />
      <input type="date" name="day" className={input} aria-label="Day away" />
      <input name="reason" placeholder="Why (optional)" className={`${input} w-44`} aria-label="Reason" />
      <button type="submit" disabled={pending} className={button}>
        Block the day
      </button>
      {state.error ? <p className="m-0 basis-full text-[13px] text-[var(--color-atrisk)]">{state.error}</p> : null}
    </form>
  );
}

export { DAYS };
