'use client';

import { useActionState, useState } from 'react';
import { setHiddenAsTestAction } from './actions';
import type { RecordResult } from '@/modules/verification/record';

/**
 * "This row was a test, not a studio."
 *
 * ## Why it does not reuse the status control
 *
 * Every StudioStatus is a statement about a real studio, and SUSPENDED and
 * REMOVED both carry an appeal. Filing a row you created while testing under
 * REMOVED puts a fiction in the column that appeal reads — so this is a
 * separate axis with its own control, deliberately placed apart from Status
 * and worded so the two cannot be confused for each other.
 *
 * ## Why hiding confirms and unhiding does not
 *
 * They are not symmetrical. Hiding removes a row from the roster, from
 * matching and from every count — if it was the wrong row, nothing else on
 * this screen would tell you. Unhiding puts a row back where it is visible,
 * where being wrong announces itself immediately. A confirmation step on the
 * reversible direction is ceremony; on the irreversible-feeling one it is the
 * whole point.
 */
export function HideControl({
  studioId,
  slug,
  hiddenAt,
  tradeName,
}: {
  studioId: string;
  slug: string;
  /** ISO timestamp, or null when this is a normal studio. */
  hiddenAt: string | null;
  tradeName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<RecordResult | null, FormData>(
    async (prev, fd) => {
      const r = await setHiddenAsTestAction(prev, fd);
      if (r.ok) setConfirming(false);
      return r;
    },
    null,
  );

  const hidden = hiddenAt !== null;

  return (
    <div className="border-t border-[var(--color-rule)] pt-4">
      <p className="label m-0 mb-1">Test record</p>

      {hidden ? (
        <>
          <p className="m-0 mb-3 text-[13px] leading-snug text-[var(--color-ink-2)]">
            Hidden on {new Date(hiddenAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            . It is off the roster, out of matching and out of every count — but the row is
            untouched.
          </p>
          <form action={action}>
            <Hidden studioId={studioId} slug={slug} value="0" />
            <button
              type="submit"
              disabled={pending}
              className="rounded-full border border-[var(--color-rule)] px-4 py-1.5 text-[13px] text-[var(--color-ink)] hover:border-[var(--color-petrol)] disabled:opacity-40"
            >
              {pending ? 'Restoring…' : 'Put it back'}
            </button>
          </form>
        </>
      ) : confirming ? (
        <form action={action} className="flex flex-col gap-3">
          <Hidden studioId={studioId} slug={slug} value="1" />
          <p className="m-0 text-[13px] leading-snug text-[var(--color-ink)]">
            Hide <strong>{tradeName}</strong> as a test record? It disappears from the roster,
            from matching and from every count here. Nothing is deleted, and you can put it back.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-[var(--color-petrol)] px-4 py-1.5 text-[13px] font-medium text-[var(--color-paper)] disabled:opacity-40"
            >
              {pending ? 'Hiding…' : 'Yes, hide it'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-[13px] text-[var(--color-ink-2)] underline underline-offset-4"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="m-0 mb-3 text-[13px] leading-snug text-[var(--color-ink-2)]">
            For rows you made while testing. Not for a real studio — that is what Status is for.
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-full border border-[var(--color-rule)] px-4 py-1.5 text-[13px] text-[var(--color-ink)] hover:border-[var(--color-petrol)]"
          >
            Hide this — it was a test
          </button>
        </>
      )}

      {state && !state.ok ? (
        <p role="alert" className="m-0 mt-2 text-[13px] leading-snug text-[var(--color-atrisk)]">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

function Hidden({ studioId, slug, value }: { studioId: string; slug: string; value: '0' | '1' }) {
  return (
    <>
      <input type="hidden" name="studioId" value={studioId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="hidden" value={value} />
    </>
  );
}
