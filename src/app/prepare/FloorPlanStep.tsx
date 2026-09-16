'use client';

import { useActionState } from 'react';
import { uploadPlanAction, type PlanUploadState } from './actions';

const INITIAL: PlanUploadState = { status: 'idle' };

/**
 * The first thing on the page, and the only thing with a number attached to it.
 *
 * ## Why this goes first
 *
 * Everything else here is pleasant. This is the part that is slightly a chore —
 * find the builder's PDF, look up the carpet area on the agreement — so it gets
 * the position where attention is highest, and it gets the one piece of copy on
 * the page that states a payoff.
 *
 * ## Why the payoff numbers are passed in
 *
 * Because they are computed from this customer's own brief by the same
 * estimator that draws their quote band, and the page is only allowed to show
 * the sentence when the gain is real. A hardcoded "±22% to ±8%" would be a
 * claim nothing in the codebase keeps.
 */
export function FloorPlanStep({
  existingName,
  knownArea,
  spread,
  uploadEnabled,
}: {
  existingName: string | null;
  knownArea: number | null;
  spread: { before: string; after: string; worthSaying: boolean };
  /**
   * False when this deployment has no storage configured. The carpet-area half
   * still works and is worth more to the estimate than the file is, so the step
   * degrades to that rather than disappearing — and it says why, instead of
   * offering a file input that would fail.
   */
  uploadEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(uploadPlanAction, INITIAL);
  const done = existingName !== null || state.status === 'saved';

  return (
    <section className="mb-12 rounded-[16px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-6 sm:p-7">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="m-0 font-[family-name:var(--font-display)] text-[22px] leading-tight">
          Start with the floor plan
        </h2>
        {done ? (
          <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-ontrack)]">
            Done
          </span>
        ) : null}
      </div>

      {done ? (
        <p className="m-0 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          We have{' '}
          <span className="text-[var(--color-ink)]">
            {existingName ?? (state.status === 'saved' ? state.name : 'your plan')}
          </span>
          . The expert will have opened it before they ring, and so will any studio you go on to
          meet. Replace it below if you found a better copy.
        </p>
      ) : (
        <>
          <p className="m-0 mb-1 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
            The builder&rsquo;s plan — a PDF, or a photo of the printed sheet. It is the last thing
            we can use without standing in the flat.
          </p>
          {spread.worthSaying ? (
            <p className="m-0 mb-5 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
              Right now every quote we show you is a{' '}
              <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--color-ink)]">
                {spread.before}
              </span>{' '}
              band. With the plan and your real carpet area it narrows to{' '}
              <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--color-ink)]">
                {spread.after}
              </span>
              . That is the whole reason this is the first thing we ask for.
            </p>
          ) : (
            <p className="m-0 mb-5 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
              It will not move your quote band much further — you have already told us the things
              that matter most — but it is what stops the first site visit being a surprise.
            </p>
          )}
        </>
      )}

      <form action={action} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
        {uploadEnabled ? (
          <div className="min-w-0 flex-1">
            <label htmlFor="plan" className="label m-0 mb-2 block">
              {done ? 'Replace the plan' : 'Floor plan'} — optional
            </label>
            <input
              id="plan"
              name="plan"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="w-full rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2.5 text-[14px] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--color-paper-3)] file:px-4 file:py-1.5 file:text-[13px]"
            />
          </div>
        ) : (
          <p className="m-0 min-w-0 flex-1 text-[13.5px] leading-snug text-[var(--color-ink-3)]">
            Plan upload is not switched on for this deployment yet. The carpet area is the half that
            moves the number most, so give us that and bring the plan to the call.
          </p>
        )}

        <div className="sm:w-[11rem]">
          <label htmlFor="carpetAreaSqft" className="label m-0 mb-2 block">
            Carpet area
          </label>
          <input
            id="carpetAreaSqft"
            name="carpetAreaSqft"
            type="number"
            inputMode="numeric"
            min={150}
            max={20000}
            defaultValue={knownArea ?? undefined}
            placeholder="sqft"
            className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-5 py-3 text-[15px] tabular-nums"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-petrol)] px-6 py-3 text-[15px] font-medium text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)] disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </form>

      {state.status === 'error' ? (
        <p role="alert" className="m-0 mt-3 text-[14px] text-[var(--color-atrisk)]">
          {state.error}
        </p>
      ) : null}

      <p className="m-0 mt-4 border-t border-[var(--color-rule)] pt-3 text-[13px] leading-relaxed text-[var(--color-ink-3)]">
        Stored privately. It is not on a public URL, it is never sent to a studio you have not
        chosen, and you can ask us to delete it at any point.
      </p>
    </section>
  );
}
