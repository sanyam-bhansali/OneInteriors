'use client';

import { useState, useTransition } from 'react';
import { SlotPicker } from '@/components/SlotPicker';
import { slotLabel } from '@/modules/consultation/slots';
import { cancelCallAction, moveCallAction } from './actions';

/** Move to another open half-hour, or cancel — both said back in words. */
export function ManageCall({ token, slots }: { token: string; slots: string[] }) {
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-8">
      <section>
        <p className="oi-eyebrow m-0 mb-3">Move it</p>
        {slots.length > 0 ? (
          <>
            <SlotPicker slots={slots} value={slot} onPick={setSlot} />
            <button
              type="button"
              disabled={!slot || pending}
              onClick={() =>
                start(async () => {
                  const r = await moveCallAction(token, slot!);
                  setError(r.ok ? null : r.error);
                  if (r.ok) setSlot(null);
                })
              }
              className="oi-cta mt-5 min-h-11 cursor-pointer border-0 px-6 py-3 text-[15px] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? 'Moving…' : slot ? `Move to ${slotLabel(slot).day.split(' ')[0]} ${slotLabel(slot).time}` : 'Pick a new time above'}
            </button>
          </>
        ) : (
          <p className="m-0 text-[14.5px] text-[var(--ink2)]">No other times are open right now. Reply to your confirmation email and we will find one.</p>
        )}
      </section>

      <section className="border-t border-[var(--line)] pt-6">
        {confirmCancel ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[14.5px]">Cancel the call? Your brief and quotes stay in &ldquo;Your home&rdquo;.</span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelCallAction(token);
                  setError(r.ok ? null : r.error);
                })
              }
              className="min-h-11 cursor-pointer rounded-full border border-[var(--acc-ink)] bg-transparent px-5 py-2.5 text-[14px] font-semibold text-[var(--acc-ink)]"
            >
              {pending ? 'Cancelling…' : 'Yes, cancel it'}
            </button>
            <button type="button" onClick={() => setConfirmCancel(false)} className="cursor-pointer border-0 bg-transparent text-[14px] text-[var(--ink2)] underline">
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmCancel(true)} className="cursor-pointer border-0 bg-transparent p-0 text-[14px] text-[var(--ink2)] underline">
            Cancel the call
          </button>
        )}
      </section>

      {error ? (
        <p role="alert" className="m-0 text-[14px]" style={{ color: 'var(--acc-ink)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
