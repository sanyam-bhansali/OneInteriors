'use client';

/**
 * "Make the final quote" for a client One Interiors introduced. Once the
 * quotation is issued, the customer reads it in the app — with what changed
 * against their first quote — and can sign it there.
 */

import { useState, useTransition } from 'react';
import { finalQuoteAction } from '../../quotations/actions';

export function FinalQuote({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="rounded-[12px] border border-[var(--s-rule)] px-4 py-3.5">
      <h2 className="m-0 mb-1 text-[15px] font-semibold">Final quote, after measuring</h2>
      <p className="m-0 mb-3 text-[13.5px] leading-[1.5] text-[var(--s-ink-2)]">
        Price their flat in your builder. When you issue it, they see it in the One Interiors app, with what changed against
        their first quote, and can sign it there.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await finalQuoteAction(clientId);
            if (r && 'error' in r && r.error) setError(r.error);
          })
        }
        className="s-btn"
      >
        {pending ? 'Opening…' : 'Make the final quote'}
      </button>
      {error ? <p className="m-0 mt-2 text-[13px] text-[var(--s-bad,#a6461f)]">{error}</p> : null}
    </section>
  );
}
