'use client';

import { useState, useTransition } from 'react';
import { CALL_OUTCOMES, ago, type CallOutcomeId } from '@/modules/studio-practice/event-copy';
import { logContactAction } from '../actions';

/**
 * "I have just spoken to them."
 *
 * ## Why the outcome is a row of buttons and not a dropdown
 *
 * This is pressed straight after hanging up, often on a phone, by somebody
 * about to make the next call. A select is two taps and a scroll; seven
 * buttons is one tap. The cost of the extra width is the cost of the feature
 * being used at all — an outcome nobody records is a timeline full of
 * "contacted them" that says nothing.
 *
 * ## Why "No answer" is first
 *
 * It is the most common outcome of ringing a stranger. A list ordered by how
 * well the call went buries the realistic option under four optimistic ones,
 * and gets misclicked.
 *
 * ## The note is optional and stays optional
 *
 * Requiring it would mean every call costs a sentence, so calls stop being
 * logged. One tap has to be enough, and the note is there for the call that
 * actually produced something worth remembering.
 */
export function LogContact({
  clientId,
  lastContactedAt,
}: {
  clientId: string;
  lastContactedAt: Date | null;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function log(outcome: CallOutcomeId) {
    setError(null);
    start(async () => {
      const result = await logContactAction(clientId, outcome, note.trim() || null);
      if ('error' in result) {
        setError(result.error);
      } else {
        setNote('');
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[8px] bg-[var(--s-accent)] px-3.5 py-2 text-[13.5px] font-medium text-white"
        >
          Log a contact
        </button>
        <span className="text-[13px] text-[var(--s-ink-3)]">
          {lastContactedAt ? `Last spoke ${ago(lastContactedAt)}` : 'Nobody has logged a call yet'}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-[var(--s-rule)] px-4 py-3.5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[14px] font-semibold">What happened?</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[13px] text-[var(--s-ink-3)] hover:text-[var(--s-ink)]"
        >
          Cancel
        </button>
      </div>

      {/* The note sits ABOVE the buttons on purpose: the buttons commit, so
          anything typed after pressing one would be lost. Ordering the
          controls in the order they are used is the whole trick. */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Anything worth remembering (optional)"
        className="mb-3 w-full resize-y rounded-[9px] border border-[var(--s-rule)] bg-transparent px-3 py-2 text-[13.5px]"
      />

      <div className="flex flex-wrap gap-2">
        {CALL_OUTCOMES.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={pending}
            onClick={() => log(o.id)}
            className="rounded-full border border-[var(--s-rule)] px-3 py-1.5 text-[13px] transition-colors hover:border-[var(--s-ink-3)] hover:bg-[var(--s-rail-active)]/60 disabled:opacity-50"
          >
            {o.label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="m-0 mt-3 text-[13px] text-[var(--s-danger,#98371f)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
