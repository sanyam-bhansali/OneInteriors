'use client';

import { useActionState } from 'react';
import { setGstinAction } from './actions';

/**
 * The ops escape hatch for GST registration.
 *
 * `setGstinAction` existed in the codebase with nothing rendering it, which
 * mattered more than dead code usually does: the studio-side registration step
 * could not record "we have no GSTIN" either, so a proprietorship below the GST
 * threshold was stuck on both sides of the marketplace at once. They could not
 * finish onboarding, and no ops person could enter the number for them or wave
 * them through.
 *
 * The studio side now has both answers. This is the other half — for the
 * common case where a studio reads the GSTIN out on a phone call and would
 * rather somebody just typed it in.
 *
 * Entering a number here is still a CLAIM, exactly as it is when the studio
 * types it. It earns nothing until a `VerificationCheck` records a portal
 * lookup against it.
 */
export function GstinControl({
  studioId,
  slug,
  current,
  notApplicable,
  note,
}: {
  studioId: string;
  slug: string;
  current: string | null;
  notApplicable: boolean;
  note: string | null;
}) {
  const [state, action, pending] = useActionState(setGstinAction, null);

  return (
    <div className="mt-4 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-4">
      {notApplicable ? (
        <p className="m-0 mb-3 border-l-2 border-[var(--color-brass)] pl-3 text-[13.5px] leading-relaxed text-[var(--color-ink)]">
          <span className="label mr-2">Studio says no registration</span>
          {note ?? 'No reason given.'}
          <span className="mt-1 block text-[12.5px] text-[var(--color-ink-3)]">
            Verify this one on PAN and bank records, with an extra reference call.
          </span>
        </p>
      ) : null}

      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="studioId" value={studioId} />
        <input type="hidden" name="slug" value={slug} />

        <div className="min-w-0 flex-1">
          <label htmlFor="ops-gstin" className="label m-0 mb-1.5 block">
            {current ? 'Correct the GSTIN' : 'Enter a GSTIN on their behalf'}
          </label>
          <input
            id="ops-gstin"
            name="gstin"
            defaultValue={current ?? ''}
            placeholder="27AAPFU0939F1ZV"
            className="w-full rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2.5 font-[family-name:var(--font-mono)] text-[14px] uppercase"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[var(--color-petrol)] px-5 py-2.5 text-[14px] text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)] disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </form>

      {state && !state.ok ? (
        <p role="alert" className="m-0 mt-2 text-[13.5px] text-[var(--color-atrisk)]">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="m-0 mt-2 text-[13.5px] text-[var(--color-ontrack)]">
          Saved as a claim. It earns nothing until the portal check is recorded below.
        </p>
      ) : null}
    </div>
  );
}
