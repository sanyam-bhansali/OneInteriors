'use client';

/**
 * Small shared pieces for the Studio OS Phase 1 screens: the inline
 * success / error line every action shows, and a hook that runs an action
 * and keeps its answer. One look everywhere: green when it worked, the bad
 * colour when it did not, in plain words, right under the button pressed.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Done } from './sales-types';

export function Said({ result }: { result: { ok: boolean; message?: string; error?: string } | null }) {
  if (!result) return null;
  if (result.ok && !result.message) return null;
  return (
    <p
      role={result.ok ? 'status' : 'alert'}
      className={`m-0 mt-2 text-[13px] leading-relaxed ${result.ok ? 'text-[var(--s-good)]' : 'text-[var(--s-bad)]'}`}
    >
      {result.ok ? result.message : result.error}
    </p>
  );
}

/** Run a server action, keep what it said, refresh the page when it worked. */
export function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Done | null>(null);
  const run = (fn: () => Promise<Done>, after?: (r: Done) => void) =>
    start(async () => {
      try {
        const r = await fn();
        // An action that redirects (open the new quotation) comes back with nothing.
        if (!r) return;
        setResult(r);
        if (r.ok) router.refresh();
        after?.(r);
      } catch (error) {
        // A redirect from the action is how "open the new quotation" works.
        if (error && typeof error === 'object' && 'digest' in error && String((error as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT')) throw error;
        setResult({ ok: false, error: 'That did not go through. Check your connection and try again.' });
      }
    });
  return { pending, result, setResult, run };
}

export const inputClass =
  'w-full rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14px] text-[var(--s-ink)] placeholder:text-[var(--s-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
export const primaryClass =
  'rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[14px] font-medium text-white no-underline hover:bg-[var(--s-accent-deep)] disabled:opacity-40';
export const quietClass =
  'rounded-[8px] border border-[var(--s-rule)] px-3 py-1.5 text-[13px] font-medium no-underline hover:border-[var(--s-ink-3)] disabled:opacity-40';
