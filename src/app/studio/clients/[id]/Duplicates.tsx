'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { DuplicateCandidate } from '@/modules/studio-practice/merge';
import { mergeAction } from '../actions';

/**
 * "This number is also on another card."
 *
 * ## Why it asks rather than merging
 *
 * The match is phone-exact, and an exact phone match is strong evidence and
 * not proof: two people in one family share a number, and a builder's office
 * number reaches four flats. So this shows what it found, says what merging
 * would do, and leaves the decision.
 *
 * Name matching is deliberately not offered. "Sharma" is not a person, and a
 * fuzzy match that once proposes merging two unrelated families is a feature
 * nobody trusts again.
 *
 * ## Why the confirmation is a second click and not a dialog
 *
 * A merge is reversible in the sense that nothing is deleted, and awkward to
 * reverse in practice. A browser `confirm()` is the thing people click
 * through without reading; a button that changes into a different button they
 * have to press again is not.
 */
export function Duplicates({
  clientId,
  clientName,
  candidates,
}: {
  clientId: string;
  clientName: string;
  candidates: DuplicateCandidate[];
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (candidates.length === 0) return null;

  function merge(loserId: string) {
    setError(null);
    start(async () => {
      const result = await mergeAction(clientId, loserId);
      if ('error' in result) setError(result.error);
      else setConfirming(null);
    });
  }

  return (
    <section className="rounded-[12px] border border-[var(--s-warn,#8a6220)]/35 bg-[var(--s-warn,#8a6220)]/[0.05] px-4 py-3.5">
      <h2 className="m-0 mb-1 text-[14.5px] font-semibold">
        {candidates.length === 1 ? 'Another card has' : `${candidates.length} other cards have`} this
        number
      </h2>
      <p className="m-0 mb-3 max-w-[62ch] text-[12.5px] leading-relaxed text-[var(--s-ink-2)]">
        Merging keeps <strong>{clientName}</strong> and moves the other card&rsquo;s quotations,
        projects and notes onto it. Nothing is deleted — the other card goes to the bin with a note
        saying where it went.
      </p>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {candidates.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[9px] border border-[var(--s-rule)] bg-[var(--s-rail)] px-3 py-2"
          >
            <Link
              href={`/studio/clients/${c.id}`}
              className="text-[13.5px] font-medium no-underline hover:underline"
            >
              {c.name}
            </Link>
            <span className="text-[12.5px] text-[var(--s-ink-3)]">
              {[
                c.stageName,
                c.assignedToName ?? 'nobody on it',
                c.quoteCount > 0
                  ? `${c.quoteCount} quotation${c.quoteCount === 1 ? '' : 's'}`
                  : null,
                `added ${c.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>

            <span className="ml-auto flex items-center gap-2">
              {confirming === c.id ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => merge(c.id)}
                    className="rounded-[7px] bg-[var(--s-accent)] px-2.5 py-1 text-[12.5px] font-medium text-white disabled:opacity-50"
                  >
                    {pending ? 'Merging…' : `Merge into ${clientName}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="text-[12.5px] text-[var(--s-ink-3)] hover:text-[var(--s-ink)]"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(c.id)}
                  className="rounded-[7px] border border-[var(--s-rule)] px-2.5 py-1 text-[12.5px] font-medium hover:border-[var(--s-ink-3)]"
                >
                  Same person
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="m-0 mt-2.5 text-[12.5px] text-[var(--s-bad)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
