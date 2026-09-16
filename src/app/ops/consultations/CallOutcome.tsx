'use client';

import { useState, useTransition } from 'react';
import { completeCallAction, scheduleCallAction } from './actions';
import type { AppointmentKindName } from '@/modules/studio/appointment-rules';

/**
 * What the expert fills in when the call ends.
 *
 * ## Why `matchWasCorrect` is a required choice rather than a checkbox
 *
 * It is the only feedback the matching engine will ever get. A checkbox
 * defaults to false and gets left alone, which would quietly fill the column
 * with "the engine was wrong" on every call nobody thought about. Two buttons
 * with no default means the expert answers or the form does not submit.
 *
 * ## Why introducing is a deliberate tick
 *
 * Recording that a call happened and handing a customer's phone number to a
 * business are different acts with different consequences, and the second one
 * cannot be a side effect of the first. Defaulted on, because it is the normal
 * outcome — but visible, and switchable, because sometimes the customer wants
 * to think about it.
 */
export function CallOutcome({
  consultationId,
  briefId,
  status,
  studios,
}: {
  consultationId: string;
  briefId: string;
  status: string;
  studios: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [callAt, setCallAt] = useState('');
  const [studioId, setStudioId] = useState(studios[0]?.id ?? '');
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [introduce, setIntroduce] = useState(true);
  const [release, setRelease] = useState(true);
  const [kind, setKind] = useState<AppointmentKindName>('FIRST_MEETING');
  const [when, setWhen] = useState('');
  const [location, setLocation] = useState('');

  if (done) {
    return (
      <p className="m-0 mt-4 rounded-[10px] bg-[var(--color-ontrack-soft)] px-4 py-3 text-[14px] text-[var(--color-ink)]">
        Recorded. {introduce ? 'Introduction made.' : 'No introduction made.'}
      </p>
    );
  }

  if (!open) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {status === 'requested' ? (
          <>
            {/* A date, not just a status. "Mark scheduled" used to record that
                a decision had been made without recording what it was —
                `scheduledFor` had no writer anywhere in the codebase. */}
            <input
              type="datetime-local"
              value={callAt}
              onChange={(e) => setCallAt(e.target.value)}
              aria-label="When is the call?"
              className="rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-1.5 text-[13px]"
            />
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  setError(null);
                  // `datetime-local` gives "2026-09-20T15:30" with no offset.
                  // Passed through as-is, `new Date()` runs on the server and
                  // reads it as server-local — UTC on Vercel — so a 3:30pm IST
                  // call is stored as 9pm IST. Convert here, where the
                  // browser's zone is the one that knows what the expert meant.
                  const result = await scheduleCallAction(
                    consultationId,
                    callAt ? new Date(callAt).toISOString() : undefined,
                  );
                  if (!result.ok) setError(result.error);
                })
              }
              disabled={pending}
              className="rounded-full border border-[var(--color-rule)] px-4 py-1.5 text-[13px] text-[var(--color-ink-2)] hover:text-[var(--color-ink)] disabled:opacity-40"
            >
              Mark scheduled
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-[var(--color-petrol)] px-4 py-1.5 text-[13px] text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)]"
        >
          Call done — record it
        </button>
        {error ? (
          <span role="alert" className="text-[13px] text-[var(--color-atrisk)]">
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  function submit() {
    setError(null);
    if (correct === null) {
      setError('Say whether our ranking was right. It is the only feedback the engine gets.');
      return;
    }

    start(async () => {
      const result = await completeCallAction({
        consultationId,
        briefId,
        recommendedStudioId: studioId,
        matchWasCorrect: correct,
        notes,
        introduce,
        releaseContact: release,
        appointmentKind: when ? kind : undefined,
        // Same timezone conversion as the scheduling button above — a bare
        // `datetime-local` value is not an instant.
        appointmentAt: when ? new Date(when).toISOString() : undefined,
        appointmentLocation: location || undefined,
      });

      if (result.ok) setDone(true);
      else setError(result.error);
    });
  }

  return (
    <div className="mt-4 rounded-[12px] border border-[var(--color-petrol)] bg-[var(--color-paper)] p-5">
      <p className="label m-0 mb-4">After the call</p>

      <div className="mb-4">
        <label htmlFor={`studio-${consultationId}`} className="label m-0 mb-1.5 block">
          Which studio did you recommend?
        </label>
        <select
          id={`studio-${consultationId}`}
          value={studioId}
          onChange={(e) => setStudioId(e.target.value)}
          className="w-full rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-2.5 text-[14.5px]"
        >
          {studios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <p className="label m-0 mb-1.5">Was our ranking right?</p>
        <div className="flex gap-2">
          <Toggle active={correct === true} onClick={() => setCorrect(true)}>
            Yes — we ranked them near the top
          </Toggle>
          <Toggle active={correct === false} onClick={() => setCorrect(false)}>
            No — we got the order wrong
          </Toggle>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor={`notes-${consultationId}`} className="label m-0 mb-1.5 block">
          What actually decided it?
        </label>
        <textarea
          id={`notes-${consultationId}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Went with the cheaper kitchen quote but liked the other studio's work more. Timeline was the deciding factor."
          className="w-full rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-3 text-[14.5px] leading-relaxed"
        />
      </div>

      <label className="mb-3 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={introduce}
          onChange={(e) => setIntroduce(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--color-petrol)]"
        />
        <span className="text-[14.5px] leading-snug text-[var(--color-ink)]">
          Introduce them to this studio
          <span className="block text-[13px] text-[var(--color-ink-3)]">
            Creates the handoff record. Nothing else in the product does this.
          </span>
        </span>
      </label>

      {introduce ? (
        <>
          <label className="mb-4 flex cursor-pointer items-start gap-3 pl-7">
            <input
              type="checkbox"
              checked={release}
              onChange={(e) => setRelease(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--color-petrol)]"
            />
            <span className="text-[14.5px] leading-snug text-[var(--color-ink)]">
              Release contact details now
              <span className="block text-[13px] text-[var(--color-ink-3)]">
                Untick if the customer wants to think about it — the studio will see a brief is
                coming and nothing about who.
              </span>
            </span>
          </label>

          <div className="mb-4 grid gap-3 pl-7 sm:grid-cols-3">
            <div>
              <label htmlFor={`kind-${consultationId}`} className="label m-0 mb-1.5 block">
                First meeting
              </label>
              <select
                id={`kind-${consultationId}`}
                value={kind}
                onChange={(e) => setKind(e.target.value as AppointmentKindName)}
                className="w-full rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2.5 text-[14px]"
              >
                <option value="FIRST_MEETING">First meeting</option>
                <option value="SITE_VISIT">Site visit</option>
              </select>
            </div>
            <div>
              <label htmlFor={`when-${consultationId}`} className="label m-0 mb-1.5 block">
                When — optional
              </label>
              <input
                id={`when-${consultationId}`}
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="w-full rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2.5 text-[14px]"
              />
            </div>
            <div>
              <label htmlFor={`where-${consultationId}`} className="label m-0 mb-1.5 block">
                Where
              </label>
              <input
                id={`where-${consultationId}`}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="The flat"
                className="w-full rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2.5 text-[14px]"
              />
            </div>
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="m-0 mb-3 text-[13.5px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-full bg-[var(--color-petrol)] px-5 py-2 text-[14px] text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)] disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Record it'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-[var(--color-rule)] px-5 py-2 text-[14px] text-[var(--color-ink-2)]"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-1.5 text-[13px] ${
        active
          ? 'bg-[var(--color-petrol)] text-[var(--color-paper)]'
          : 'border border-[var(--color-rule)] text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
      }`}
    >
      {children}
    </button>
  );
}
