'use client';

import { useActionState, useState } from 'react';
import { decideAction, type DecisionState } from './actions';

// The shared <Button> takes no name/value, and the decision has to travel with
// the submit button so the form works without JS. So these are raw buttons
// wearing the same classes.
const BTN =
  'inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const PRIMARY = `${BTN} bg-[var(--color-petrol)] text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)]`;
const GHOST = `${BTN} bg-transparent px-0 text-[var(--color-petrol)] underline-offset-4 hover:underline`;

const INITIAL: DecisionState = { status: 'idle' };

/**
 * Approve is destructive-ish (it creates a studio and emails a stranger), so it
 * asks twice. Reject requires a reason before the button is even enabled —
 * enforced again server-side, because a disabled button is not a rule.
 */
export function DecisionForm({ id, tradeName }: { id: string; tradeName: string }) {
  const [state, action, pending] = useActionState(decideAction, INITIAL);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);

  if (state.status === 'done') {
    return (
      <p className="m-0 rounded-[10px] bg-[var(--color-ontrack-soft)] px-4 py-3 text-[14px] text-[var(--color-ontrack)]">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="border-t border-[var(--color-rule)] pt-5">
      <input type="hidden" name="id" value={id} />

      {state.status === 'error' ? (
        <p role="alert" className="m-0 mb-3 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-2.5 text-[14px] text-[var(--color-atrisk)]">
          {state.message}
        </p>
      ) : null}

      <label htmlFor={`note-${id}`} className="label m-0 mb-2 block">
        Note / reason
      </label>
      <textarea
        id={`note-${id}`}
        name="note"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Called Rhea 6 Sep — 9 yrs, own carpentry team, two Kharadi sites we can visit."
        className="mb-3 w-full rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2.5 text-[14.5px] leading-relaxed"
      />

      <div className="flex flex-wrap items-center gap-3">
        {confirming ? (
          <>
            <span className="text-[14px] text-[var(--color-ink-2)]">
              Create <strong>{tradeName}</strong> and email them a sign-in link?
            </span>
            <button type="submit" name="intent" value="approve" disabled={pending} className={PRIMARY}>
              {pending ? 'Approving…' : 'Yes, approve'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-[14px] text-[var(--color-ink-3)] underline"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setConfirming(true)} disabled={pending} className={PRIMARY}>
              Approve
            </button>
            <button
              type="submit"
              name="intent"
              value="reject"
              disabled={pending || note.trim().length < 10}
              title={note.trim().length < 10 ? 'A reason is required to reject.' : undefined}
              className={GHOST}
            >
              Reject
            </button>
            <button
              type="submit"
              name="intent"
              value="reviewing"
              disabled={pending}
              className="text-[13.5px] text-[var(--color-ink-3)] underline"
            >
              Mark as reviewing
            </button>
          </>
        )}
      </div>
    </form>
  );
}
