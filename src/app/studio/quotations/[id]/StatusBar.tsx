'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { LineIcon } from '../../ui/icons';
import { copyQuoteAction, deleteQuoteAction, generatePdfAction } from '../actions';
import type { QuoteStatusName } from '@/modules/studio-quote/quotes';

/**
 * What happens to a quotation after it is written.
 *
 * Four states and no workflow engine: a studio marks it sent when they send it,
 * and won or lost when they find out. Inferring "sent" from the print button
 * would be wrong often enough to matter — a designer prints a draft to read it
 * on paper, and that must not tell the pipeline a client has seen it.
 *
 * Printing is a link rather than a button because the print view is a real page
 * a studio may want to keep open beside the builder.
 */
export function StatusBar({
  quoteId,
  status,
  canPrint,
  basedOnId,
  deletable,
}: {
  quoteId: string;
  status: QuoteStatusName;
  canPrint: boolean;
  /** The Sales Final this was made from, for Compare. */
  basedOnId: string | null;
  /** A draft never sent and not a customer's final quote. */
  deletable: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [templating, setTemplating] = useState(false);
  const [newClient, setNewClient] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* The copy and delete actions redirect on success; they only come back to
     say what went wrong. */
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      const result = (await fn()) as { ok?: boolean; error?: string } | undefined;
      setError(result && result.ok === false ? (result.error ?? 'That did not work.') : null);
    });


  /* Generate PDF (owner, 22 Nov 2026): the PDF opens at once in its own tab; the copy is saved as the next
     revision meanwhile (generatePdfAction). The tab is opened before the save so the browser does not block it. */
  const generate = () => {
    if (document.body.dataset.quoteDirty === '1') {
      setError('Changes are still saving. Save (or wait a few seconds for autosave), then Generate PDF.');
      return;
    }
    const tab = window.open(`/studio/quotations/${quoteId}/print`, '_blank');
    start(async () => {
      const result = await generatePdfAction(quoteId, status);
      if (result && 'ok' in result && !result.ok) {
        tab?.close();
        setError(result.error);
      } else setError(null);
    });
  };

  return (
    <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
      {error ? <span className="qerr">{error}</span> : null}

      {/* Owner, 22 Nov 2026: "We want to make quotation builder layout as simple as humanly possible" — two buttons. */}
      {basedOnId ? (
        <Link href={`/studio/quotations/${quoteId}/compare`} className="btn sec">
          Compare with Sales Final
        </Link>
      ) : null}

      {canPrint ? (
        <button type="button" onClick={generate} disabled={pending} className="btn pri" title="Opens the PDF and keeps this copy as the next revision (R1, R2…) when it has changed" data-testid="generate-pdf">
          <LineIcon name="eye" size={16} />
          {pending ? 'Saving…' : 'Generate PDF'}
        </button>
      ) : null}

      {/* Rarely needed, out of the way. */}
      <details className="qmore" style={{ position: 'relative' }}>
        <summary className="btn ghost sm" aria-label="More">More</summary>
        <div className="hstack" style={{ position: 'absolute', right: 0, top: 40, zIndex: 20, gap: 6, padding: 8, background: 'var(--paper)', borderRadius: 12, boxShadow: '0 12px 30px -10px rgba(0,0,0,.3), 0 0 0 1px var(--line)', flexWrap: 'wrap', minWidth: 220 }}>
          {templating ? (
            <span className="hstack" style={{ gap: 6 }}>
              <input
                value={newClient}
                onChange={(e) => setNewClient(e.target.value)}
                placeholder="New client's name"
                aria-label="New client's name"
                autoFocus
                className="fld"
                style={{ width: '12rem', minHeight: 34 }}
              />
              <button type="button" disabled={pending || newClient.trim().length < 2} onClick={() => run(() => copyQuoteAction(quoteId, 'template', newClient))} className="btn sec sm">
                Copy
              </button>
              <button type="button" onClick={() => setTemplating(false)} className="btn ghost sm">
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" disabled={pending} onClick={() => setTemplating(true)} className="btn sec sm">
              Use as template
            </button>
          )}
          {deletable ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => (confirmDelete ? run(() => deleteQuoteAction(quoteId)) : setConfirmDelete(true))}
              onBlur={() => setConfirmDelete(false)}
              className={`btn sec sm ${confirmDelete ? 'bad-t' : ''}`}
            >
              {confirmDelete ? 'Delete — press again' : 'Delete draft'}
            </button>
          ) : null}
        </div>
      </details>
    </div>
  );
}
