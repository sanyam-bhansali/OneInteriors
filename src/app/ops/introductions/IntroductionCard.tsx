'use client';

import { useState, useTransition } from 'react';
import {
  releaseContactAction,
  withdrawAction,
  confirmAppointmentAction,
  closeAppointmentAction,
  arrangeAction,
  type Result,
} from './actions';
import type { OpsIntroduction } from '@/modules/studio/introduction-ops';
/**
 * The kinds come from the state machine, not from this file.
 *
 * They were typed out by hand here as `SITE_VISIT / STUDIO_VISIT /
 * INTRO_CALL`, and two of those three do not exist — the Prisma enum is
 * `FIRST_MEETING | SITE_VISIT | FOLLOW_UP`. Choosing either invented value sent
 * an unknown enum member to `prisma.appointment.create`, which threw inside the
 * transition where nothing catches it: the button simply stopped working with
 * no error on screen. A rendered row of a real `FIRST_MEETING` had the matching
 * half of the bug and printed the raw enum name to ops.
 *
 * `KIND_LABELS` is pure and has no `server-only`, so importing it into a client
 * component is safe and there is now one list rather than two.
 */
import { KIND_LABELS, type AppointmentKindName } from '@/modules/studio/appointment-rules';

const btn =
  'rounded-full bg-[var(--color-petrol)] px-4 py-2 text-[13.5px] font-medium text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)] disabled:opacity-40';
const ghost =
  'rounded-full border border-[var(--color-rule)] px-4 py-2 text-[13.5px] font-medium hover:border-[var(--color-ink-3)] disabled:opacity-40';
const input =
  'rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2 text-[14px]';

/**
 * One introduction, with every control ops actually has.
 *
 * A client component because five of these actions are one-click and a page
 * navigation between each would make working through a list of twenty
 * unbearable. The server actions all re-check the role; nothing here is a
 * security boundary.
 */
export function IntroductionCard({
  intro,
  need = null,
}: {
  intro: OpsIntroduction;
  /** What this row is waiting on us for, when it is in that queue. */
  need?: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [arranging, setArranging] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  /**
   * Every action goes through here, and the try/catch is not decoration.
   *
   * A server action that throws rather than returning `{ok:false}` — an invalid
   * enum reaching Prisma, a dropped connection — rejects inside the transition,
   * where an unhandled rejection leaves the button dead and the screen silent.
   * Ops then presses it again, and again. Whatever happens, something has to
   * appear.
   */
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      setError(null);
      try {
        const result = await fn();
        if (!result.ok) setError(result.error);
        else {
          setArranging(false);
          setWithdrawing(false);
        }
      } catch {
        setError('That did not save, and we do not know why. Try again, then tell an engineer.');
      }
    });

  const live = intro.appointments.filter(
    (a) => a.status === 'PROPOSED' || a.status === 'CONFIRMED',
  );

  return (
    <li
      className={`rounded-[14px] border bg-[var(--color-paper-2)] p-5 ${
        intro.needs ? 'border-[var(--color-brass)]' : 'border-[var(--color-rule)]'
      } ${intro.withdrawnAt ? 'opacity-60' : ''}`}
    >
      {need ? (
        <p className="m-0 mb-2 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.11em] text-[var(--color-brass)]">
          {need}
        </p>
      ) : null}

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
        <div>
          <p className="m-0 font-[family-name:var(--font-display)] text-[19px] leading-tight">
            {intro.customerName ?? 'Customer'}
            {intro.customerPhone ? (
              <a
                href={`tel:${intro.customerPhone}`}
                className="ml-3 font-[family-name:var(--font-mono)] text-[13.5px] text-[var(--color-petrol)]"
              >
                {intro.customerPhone}
              </a>
            ) : null}
          </p>
          <p className="m-0 mt-0.5 text-[14px] text-[var(--color-ink-2)]">
            → {intro.studioName}
            {intro.locality ? ` · ${intro.locality}` : ''}
          </p>
        </div>

        <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
          {intro.introducedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
      </div>

      {intro.withdrawnAt ? (
        <p className="m-0 mb-3 border-l-2 border-[var(--color-atrisk)] pl-3 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
          Withdrawn. {intro.withdrawnReason}
        </p>
      ) : null}

      {/* Contact release. The studio sees nothing until this happens, so an
          introduction sitting here unreleased is a studio that has been told a
          brief is coming and cannot act on it. */}
      {!intro.withdrawnAt && intro.contactReleasedAt === null ? (
        <div className="mb-3 rounded-[10px] bg-[var(--color-paper-3)] px-4 py-3">
          <p className="m-0 mb-2 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
            Contact details are not released. {intro.studioName} knows a brief is coming and nothing
            about who.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => releaseContactAction(intro.id))}
            className={btn}
          >
            Release contact details
          </button>
        </div>
      ) : null}

      {/* Appointments */}
      {intro.appointments.length > 0 ? (
        <ul className="m-0 mb-3 flex list-none flex-col gap-2 p-0">
          {intro.appointments.map((a) => {
            const passed = a.startsAt.getTime() + a.durationMins * 60_000 < Date.now();
            const open = a.status === 'PROPOSED' || a.status === 'CONFIRMED';

            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-l-2 border-[var(--color-rule)] pl-3 text-[14px]"
              >
                <span className="text-[var(--color-ink)]">
                  {a.startsAt.toLocaleString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Asia/Kolkata',
                  })}
                </span>
                <span className="text-[var(--color-ink-3)]">
                  {KIND_LABELS[a.kind]}
                  {a.location ? ` · ${a.location}` : ''}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                  {a.status.toLowerCase().replace('_', ' ')}
                  {a.noShowBy ? ` · ${a.noShowBy.toLowerCase()}` : ''}
                </span>

                {open && a.status === 'PROPOSED' && !passed ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => confirmAppointmentAction(a.id))}
                    className={ghost}
                  >
                    Confirm
                  </button>
                ) : null}

                {/* Only after it has passed. Asking "did this happen" about a
                    meeting that has not is how a queue fills with noise. */}
                {open && passed ? (
                  <span className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => closeAppointmentAction(a.id, 'COMPLETED'))}
                      className={ghost}
                    >
                      It happened
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => closeAppointmentAction(a.id, 'NO_SHOW', 'CUSTOMER'))}
                      className={ghost}
                    >
                      Customer did not
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => closeAppointmentAction(a.id, 'NO_SHOW', 'STUDIO'))}
                      className={ghost}
                    >
                      Studio did not
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Arrange, or re-arrange */}
      {!intro.withdrawnAt ? (
        arranging ? (
          <form
            className="mb-3 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const local = String(form.get('startsAt') ?? '');
              if (!local) return setError('Pick a time.');

              // Checked against the real vocabulary rather than cast. The blind
              // cast is what let two invented kinds through to Prisma.
              const kind = String(form.get('kind'));
              if (!(kind in KIND_LABELS)) return setError('Pick what kind of meeting it is.');

              run(() =>
                arrangeAction({
                  introductionId: intro.id,
                  kind: kind as AppointmentKindName,
                  // Converted in the browser. A bare `datetime-local` value
                  // parses as UTC on the server, which quietly turns a 3:30pm
                  // IST site visit into 9pm.
                  startsAt: new Date(local).toISOString(),
                  location: String(form.get('location') ?? '') || undefined,
                }),
              );
            }}
          >
            <select name="kind" defaultValue="SITE_VISIT" className={input}>
              {(Object.keys(KIND_LABELS) as AppointmentKindName[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <input type="datetime-local" name="startsAt" required className={input} />
            <input name="location" placeholder="Where" className={`${input} w-[12rem]`} />
            <button type="submit" disabled={pending} className={btn}>
              {pending ? 'Saving…' : 'Arrange'}
            </button>
            <button type="button" onClick={() => setArranging(false)} className={ghost}>
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setArranging(true)} className={ghost}>
            {live.length === 0 ? 'Arrange a meeting' : 'Propose another time'}
          </button>
        )
      ) : null}

      {/* Withdraw, behind a reason. */}
      {!intro.withdrawnAt ? (
        withdrawing ? (
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const reason = String(new FormData(e.currentTarget).get('reason') ?? '');
              run(() => withdrawAction(intro.id, reason));
            }}
          >
            <input
              name="reason"
              required
              minLength={8}
              placeholder="Why — the studio will ask"
              className={`${input} min-w-[18rem] flex-1`}
            />
            <button type="submit" disabled={pending} className={ghost}>
              Withdraw
            </button>
            <button type="button" onClick={() => setWithdrawing(false)} className={ghost}>
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setWithdrawing(true)}
            className="ml-3 text-[13px] text-[var(--color-ink-3)] underline hover:text-[var(--color-atrisk)]"
          >
            Customer changed their mind
          </button>
        )
      ) : null}

      {error ? (
        <p role="alert" className="m-0 mt-3 text-[13.5px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : null}
    </li>
  );
}
