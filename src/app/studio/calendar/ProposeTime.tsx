'use client';

import { useState, useTransition } from 'react';
import { proposeAction } from './actions';
import { KIND_LABELS, type AppointmentKindName } from '@/modules/studio/appointment-rules';

/**
 * A studio suggesting a time.
 *
 * `proposeAction` existed with nothing importing it, so the only affordance on
 * this page for "that slot does not work" was copy reading *"tell us and we
 * will propose another"* — with no way to tell us anywhere on the screen. The
 * studio's options were to find our number or to let a confirmed meeting lapse.
 *
 * A proposal, not a booking. Ops confirms on the customer's behalf, because the
 * customer has no scheduling surface of their own yet and the product promises
 * we arrange it. The studio is the party that knows when its site team is free,
 * so it is the right party to suggest — it just is not the party that commits
 * somebody else's Saturday.
 */
export function ProposeTime({ introductionId }: { introductionId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [kind, setKind] = useState<AppointmentKindName>('SITE_VISIT');
  const [when, setWhen] = useState('');
  const [where, setWhere] = useState('');

  if (done) {
    return (
      <p className="m-0 mt-3 text-[13.5px] text-[var(--color-ontrack)]">
        Sent. We will put it to the customer and confirm — you will see it here either way.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-[13px] text-[var(--color-petrol)] underline underline-offset-4"
      >
        Suggest a different time
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-4">
      <p className="label m-0 mb-3">Suggest a time</p>

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`kind-${introductionId}`} className="label m-0 mb-1.5 block">
            What for
          </label>
          <select
            id={`kind-${introductionId}`}
            value={kind}
            onChange={(e) => setKind(e.target.value as AppointmentKindName)}
            className="w-full rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2.5 text-[14px]"
          >
            {(Object.keys(KIND_LABELS) as AppointmentKindName[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`when-${introductionId}`} className="label m-0 mb-1.5 block">
            When
          </label>
          <input
            id={`when-${introductionId}`}
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2.5 text-[14px]"
          />
        </div>

        <div>
          <label htmlFor={`where-${introductionId}`} className="label m-0 mb-1.5 block">
            Where
          </label>
          <input
            id={`where-${introductionId}`}
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder="The flat"
            className="w-full rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2.5 text-[14px]"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="m-0 mb-2 text-[13px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !when}
          onClick={() =>
            start(async () => {
              setError(null);
              // `datetime-local` has no offset, and `new Date()` on the server
              // would read it as UTC. Convert where the browser's zone is known.
              const result = await proposeAction(
                introductionId,
                kind,
                new Date(when).toISOString(),
                where,
              );
              if (result.ok) setDone(true);
              else setError(result.error);
            })
          }
          className="rounded-full bg-[var(--color-petrol)] px-4 py-1.5 text-[13px] text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)] disabled:opacity-40"
        >
          {pending ? 'Sending…' : 'Send to us'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-[var(--color-rule)] px-4 py-1.5 text-[13px] text-[var(--color-ink-2)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
