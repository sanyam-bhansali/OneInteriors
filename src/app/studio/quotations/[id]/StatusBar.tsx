'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { LineIcon } from '../../ui/icons';
import { deleteQuoteAction, generatePdfAction } from '../actions';
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
  viewOnly = false,
}: {
  quoteId: string;
  status: QuoteStatusName;
  canPrint: boolean;
  /** The Sales Final this was made from, for Compare. */
  basedOnId: string | null;
  /** A draft never sent and not a customer's final quote. */
  deletable: boolean;
  /** A sales rep (owner, 22 Nov 2026): the PDF opens to read; nothing is saved, and no template or delete. */
  viewOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
    if (viewOnly) return;
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
          {pending ? 'Saving…' : viewOnly ? 'View PDF' : 'Generate PDF'}
        </button>
      ) : null}

      {/* Rarely needed, out of the way. Not for a sales rep: both make or delete a quotation. */}
      {viewOnly ? null : (
      <details className="qmore" style={{ position: 'relative' }}>
        <summary className="btn ghost sm" aria-label="More">More</summary>
        <div className="hstack" style={{ position: 'absolute', right: 0, top: 40, zIndex: 20, gap: 6, padding: 8, background: 'var(--paper)', borderRadius: 12, boxShadow: '0 12px 30px -10px rgba(0,0,0,.3), 0 0 0 1px var(--line)', flexWrap: 'wrap', minWidth: 220 }}>
          {/* Owner, 22 Nov 2026: the same as on the list — New quotation with this one picked; type the name, pick the lead. */}
          <Link href={`/studio/quotations?new=1&from=${encodeURIComponent(quoteId)}#new`} className="btn sec sm" title="A new quotation with this one's rooms, items, rates and terms, for another client">
            Use as template
          </Link>
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
      )}
    </div>
  );
}
