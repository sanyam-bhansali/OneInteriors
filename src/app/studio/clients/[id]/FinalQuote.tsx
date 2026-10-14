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
    <section className="card">
      <h2 className="h">Final quote, after measuring</h2>
      <p style={{ margin: 0, lineHeight: 1.5, color: 'var(--text2)' }}>
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
        className="btn pri sm"
      >
        {pending ? 'Opening…' : 'Make the final quote'}
      </button>
      {error ? <p className="cl-err">{error}</p> : null}
    </section>
  );
}
