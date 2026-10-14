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
    <section className="card" style={{ background: 'var(--warn-bg)' }}>
      <h2 className="h" style={{ color: 'var(--warn)' }}>
        {candidates.length === 1 ? 'Another card has' : `${candidates.length} other cards have`} this
        number
      </h2>
      <p className="sm" style={{ margin: 0, maxWidth: '62ch', lineHeight: 1.5, color: 'var(--text2)' }}>
        Merging keeps <strong>{clientName}</strong> and moves the other card&rsquo;s quotations,
        projects and notes onto it. Nothing is deleted — the other card goes to the bin with a note
        saying where it went.
      </p>

      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {candidates.map((c) => (
          <li
            key={c.id}
            className="hstack" style={{ gap: 10, borderRadius: 12, background: 'var(--paper)', padding: '8px 12px' }}
          >
            <Link
              href={`/studio/clients/${c.id}`}
              style={{ fontWeight: 600 }}
            >
              {c.name}
            </Link>
            <span className="muted sm">
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

            <span className="hstack" style={{ marginLeft: 'auto', gap: 8 }}>
              {confirming === c.id ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => merge(c.id)}
                    className="btn pri xs"
                  >
                    {pending ? 'Merging…' : `Merge into ${clientName}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="btn ghost xs"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(c.id)}
                  className="btn sec xs"
                >
                  Same person
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="cl-err">
          {error}
        </p>
      ) : null}
    </section>
  );
}
