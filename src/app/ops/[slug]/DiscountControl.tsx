'use client';

import { useActionState } from 'react';
import { setCuratedDiscountAction } from './actions';

/**
 * The curated discount, recorded from the studio agreement.
 *
 * Here and not on the studio's own profile: it is a commercial term the
 * customer is promised on every quote, and the studio must not be able to
 * move it after signing. Blank clears it, and the quote then shows no line.
 */
export function DiscountControl({
  studioId,
  slug,
  current,
}: {
  studioId: string;
  slug: string;
  current: number | null;
}) {
  const [state, action, pending] = useActionState(setCuratedDiscountAction, null);

  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-4">
      <input type="hidden" name="studioId" value={studioId} />
      <input type="hidden" name="slug" value={slug} />
      <div>
        <label htmlFor="ops-discount" className="label m-0 mb-1.5 block">
          Curated discount, from the studio agreement
        </label>
        <div className="flex items-center gap-2">
          <input
            id="ops-discount"
            name="curatedDiscountPct"
            type="number"
            step="0.5"
            min="0"
            max="30"
            defaultValue={current ?? ''}
            className="w-24 rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2.5 font-[family-name:var(--font-mono)] text-[14px]"
          />
          <span className="text-[14px] text-[var(--color-ink-3)]">%</span>
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[var(--color-petrol)] px-5 py-2.5 text-[14px] text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)] disabled:opacity-40"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="m-0 basis-full text-[13.5px] text-[var(--color-atrisk)]">{state.error}</p>
      ) : null}
      {state?.ok ? <p className="m-0 basis-full text-[13.5px] text-[var(--color-ontrack)]">Saved. Every quote for this studio now carries it.</p> : null}
    </form>
  );
}
