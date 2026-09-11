'use client';

import { useState, useTransition } from 'react';
import { sweepAction } from './actions';

/**
 * Runs the pause sweep and says what it did.
 *
 * The result line matters as much as the button. A sweep that silently changes
 * the roster is a sweep ops stops trusting, and "nothing needed changing" is a
 * useful answer rather than a failure — it means the roster already matches
 * what everyone declared.
 */
export function SweepButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const result = await sweepAction();
            if (result.ok) setMessage(result.message);
            else setError(result.error);
          });
        }}
        className="rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-2 text-[13.5px] text-[var(--color-ink-2)] hover:border-[var(--color-ink-3)] disabled:opacity-40"
      >
        {pending ? 'Checking the roster…' : 'Run capacity and payment check'}
      </button>

      {message ? (
        <span className="text-[13.5px] text-[var(--color-ink-2)]">{message}</span>
      ) : null}
      {error ? (
        <span className="text-[13.5px] text-[var(--color-atrisk)]">{error}</span>
      ) : null}
    </div>
  );
}
