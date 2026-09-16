'use client';

import { useActionState, useState } from 'react';
import { saveGstinAction, declareNoGstinAction, type StepState } from './actions';
import { Field, SaveBar } from './fields';

const INITIAL: StepState = { status: 'idle' };

/**
 * The registration step.
 *
 * ## The bug this shape fixes
 *
 * The rule has always been "a GSTIN, or a note that you do not have one". For a
 * long time this page carried a heading reading *"If you do not have a
 * GSTIN"* followed by a paragraph telling the studio to tell us — under which
 * there was no control of any kind. Prose, and nothing to type into.
 *
 * The step's completion test read `if (!studio.gstin)`, so a proprietorship
 * below the GST threshold could finish every other step and then find the
 * submit button permanently greyed out. Ops could not fix it either: the action
 * that writes a GSTIN on their side was never rendered. A real studio in that
 * position could not join, and nobody could let them in.
 *
 * Both answers now exist, and they are mutually exclusive — recording a number
 * clears the note, and declaring no registration clears the number.
 */
export function RegistrationForm({
  gstin,
  notApplicable,
  note,
}: {
  gstin: string | null;
  notApplicable: boolean;
  note: string | null;
}) {
  const [state, action, pending] = useActionState(saveGstinAction, INITIAL);
  const [noState, noAction, noPending] = useActionState(declareNoGstinAction, INITIAL);

  // Which answer is being given. Opens on whichever one is already recorded, so
  // a studio returning to change it sees their own answer rather than a
  // default.
  const [answer, setAnswer] = useState<'has' | 'none'>(notApplicable ? 'none' : 'has');

  const err = state.errors ?? {};
  const noErr = noState.errors ?? {};

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-3)] p-6">
        <p className="label m-0 mb-2">Why we ask</p>
        <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          Your GSTIN is how we confirm the business exists, who owns it, and that filings are
          current. We check it against the public GST record — we are not asking you to prove
          anything to us that is not already public. The number itself is never shown on your
          profile; what appears is the badge it earns.
        </p>
      </div>

      <fieldset className="m-0 border-0 p-0">
        <legend className="label m-0 mb-3 p-0">Do you have a GST registration?</legend>
        <div className="flex flex-wrap gap-2">
          <Choice active={answer === 'has'} onClick={() => setAnswer('has')}>
            Yes — here it is
          </Choice>
          <Choice active={answer === 'none'} onClick={() => setAnswer('none')}>
            No, we are not registered
          </Choice>
        </div>
      </fieldset>

      {answer === 'has' ? (
        <form action={action} className="flex flex-col gap-6">
          <Field
            label="GSTIN"
            name="gstin"
            required
            defaultValue={gstin}
            error={err.gstin}
            hint="Fifteen characters, as on the certificate. We check the format immediately so a typo does not cost you a week."
            placeholder="27AAPFU0939F1ZV"
            width="sm"
            mono
          />

          {gstin ? (
            <p className="m-0 text-[14px] text-[var(--color-ontrack)]">
              Recorded. It still has to be confirmed against the GST portal by us before it counts
              towards your badge.
            </p>
          ) : null}

          <SaveBar
            pending={pending}
            saved={state.status === 'saved'}
            formError={err.form}
            label="Save GSTIN"
          />
        </form>
      ) : (
        <form action={noAction} className="flex flex-col gap-6">
          <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
            Plenty of good studios are proprietorships that have not registered, and that is not a
            disqualification. It does mean we verify you a different way — PAN, bank records and an
            extra reference call. Tell us which it is so whoever picks up your file knows what to
            check instead of guessing.
          </p>

          <div>
            <label htmlFor="gstinNote" className="label m-0 mb-2 block">
              Why not, in a sentence
            </label>
            <textarea
              id="gstinNote"
              name="gstinNote"
              rows={3}
              defaultValue={note ?? ''}
              placeholder="Proprietorship, turnover below the registration threshold. Registration applied for last month."
              className="w-full rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-4 text-[15.5px] leading-relaxed"
            />
            {noErr.gstinNote ? (
              <p role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
                {noErr.gstinNote}
              </p>
            ) : null}
          </div>

          {notApplicable ? (
            <p className="m-0 text-[14px] text-[var(--color-ontrack)]">
              Recorded. This step is complete — we will verify you the other way.
            </p>
          ) : null}

          <SaveBar
            pending={noPending}
            saved={noState.status === 'saved'}
            formError={noErr.form}
            label="Save this"
          />
        </form>
      )}
    </div>
  );
}

function Choice({
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
      className={`rounded-full px-5 py-2.5 text-[14.5px] ${
        active
          ? 'bg-[var(--color-petrol)] text-[var(--color-paper)]'
          : 'border border-[var(--color-rule)] text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
      }`}
    >
      {children}
    </button>
  );
}
