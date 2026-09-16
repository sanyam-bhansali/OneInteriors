'use client';

import { useActionState, useState } from 'react';
import { createQuoteAction, IDLE } from './actions';

const input =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14.5px] text-[var(--s-ink)] placeholder:text-[var(--s-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const primary =
  'rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[14px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40';
const quiet =
  'rounded-[8px] border border-[var(--s-rule)] px-3.5 py-2 text-[14px] font-medium hover:border-[var(--s-ink-3)]';

/**
 * Starting a quotation.
 *
 * A name is the only required field. Everything else — phone, society,
 * configuration, carpet area — is asked because it prints on the document and
 * saves typing later, not because we need it. A studio on the phone to a client
 * should be able to open a quotation in four seconds and fill the rest in
 * afterwards.
 */
export function NewQuote({ blocked }: { blocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createQuoteAction, IDLE);

  if (blocked) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primary}>
        + New quotation
      </button>
    );
  }

  return (
    <form
      action={action}
      className="s-card absolute right-0 top-full z-20 mt-2 flex w-[min(30rem,calc(100vw-2rem))] flex-col gap-3 p-5 shadow-lg"
    >
      <p className="m-0 text-[15px] font-semibold">New quotation</p>

      <label className="flex flex-col gap-1.5">
        <span className="s-label">Client name</span>
        <input name="clientName" required autoFocus placeholder="Mrs Kothari" className={input} />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="s-label">Phone — optional</span>
          <input name="clientPhone" inputMode="tel" className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="s-label">Config — optional</span>
          <input name="config" placeholder="3 BHK" className={`${input} w-[7rem]`} />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="s-label">Society or address — optional</span>
          <input name="society" placeholder="Kalyani Nagar" className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="s-label">Carpet — optional</span>
          <input name="carpetSqft" inputMode="numeric" placeholder="1150" className={`${input} s-num w-[7rem] text-right`} />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? 'Creating…' : 'Create and start'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={quiet}>
          Cancel
        </button>
      </div>

      {'ok' in state && !state.ok ? (
        <p role="alert" className="m-0 text-[13px] text-[var(--s-bad)]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
