'use client';

import { useActionState } from 'react';
import { saveGstinAction, type StepState } from './actions';
import { Field, SaveBar } from './fields';

const INITIAL: StepState = { status: 'idle' };

export function RegistrationForm({ gstin }: { gstin: string | null }) {
  const [state, action, pending] = useActionState(saveGstinAction, INITIAL);
  const err = state.errors ?? {};

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

      <form action={action} className="flex flex-col gap-6">
        <Field
          label="GSTIN"
          name="gstin"
          required
          defaultValue={gstin}
          error={err.gstin}
          hint="Fifteen characters, as on the certificate. We check the format immediately so a typo does not cost you a week."
          placeholder="27AAPFU0939F1ZV"
        />

        {gstin ? (
          <p className="m-0 text-[14px] text-[var(--color-ontrack)]">
            Recorded. It still has to be confirmed against the GST portal by us before it counts
            towards your badge.
          </p>
        ) : null}

        <SaveBar pending={pending} saved={state.status === 'saved'} formError={err.form} label="Save GSTIN" />
      </form>

      <div className="border-t border-[var(--color-rule)] pt-6">
        <p className="h3 mb-2">If you do not have a GSTIN</p>
        <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          Plenty of good studios are proprietorships that have not registered, and that is not a
          disqualification. It does mean we verify you a different way — PAN, bank records and an
          extra reference call — so tell us rather than leaving this blank, and we will set it up.
          A blank field just looks like an unfinished form to whoever picks up your file.
        </p>
      </div>
    </div>
  );
}
