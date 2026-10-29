'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { LineIcon } from '../../ui/icons';
import { copyQuoteAction, deleteQuoteAction, setStatusAction } from '../actions';
import type { QuoteStageName, QuoteStatusName } from '@/modules/studio-quote/quotes';

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
  stage,
  basedOnId,
  deletable,
  clientFirstName = '',
}: {
  quoteId: string;
  status: QuoteStatusName;
  canPrint: boolean;
  stage: QuoteStageName;
  /** The Sales Final this was made from, for Compare. */
  basedOnId: string | null;
  /** A draft never sent and not a customer's final quote. */
  deletable: boolean;
  /** For the button's words: "Mark as sent to Priya". */
  clientFirstName?: string;
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

  const set = (next: QuoteStatusName) =>
    start(async () => {
      const result = await setStatusAction(quoteId, next);
      setError(result && 'ok' in result && !result.ok ? result.error : null);
    });

  return (
    <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
      {error ? <span className="qerr">{error}</span> : null}

      {status === 'DRAFT' ? (
        <button
          type="button"
          disabled={pending || !canPrint}
          onClick={() => set('ISSUED')}
          className="btn pri"
          title={stage === 'DESIGN' ? 'When this is the design final you send the client; the copy they have is kept, and the earlier drafts stay in the quotation’s history' : 'When you have sent it to the client; the copy they have is kept as a revision'}
        >
          <LineIcon name="arrow" size={16} />
          {/* The design team (27 Oct 2026): "Make it design final" belongs here, on the quotation, after the changes. */}
          {stage === 'DESIGN' ? 'Mark as design final' : 'Mark as sent'}
          {clientFirstName ? ` to ${clientFirstName}` : ''}
        </button>
      ) : null}

      {status === 'ISSUED' ? (
        <>
          <button type="button" disabled={pending} onClick={() => set('ACCEPTED')} className="btn sec sm">
            Won
          </button>
          <button type="button" disabled={pending} onClick={() => set('DECLINED')} className="btn sec sm">
            Lost
          </button>
        </>
      ) : null}

      {status === 'ACCEPTED' || status === 'DECLINED' ? (
        <button type="button" disabled={pending} onClick={() => set('ISSUED')} className="btn sec sm">
          Reopen
        </button>
      ) : null}

      {basedOnId ? (
        <Link href={`/studio/quotations/${quoteId}/compare`} className="btn sec sm">
          Compare with Sales Final
        </Link>
      ) : null}

      {stage === 'SALES' && canPrint ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => copyQuoteAction(quoteId, 'design-final'))}
          className="btn sec sm"
          title="A copy for after design sign-off; this Sales Final stays as sent"
        >
          Make Design Final
        </button>
      ) : null}

      {templating ? (
        <span className="hstack" style={{ gap: 6 }}>
          <input
            value={newClient}
            onChange={(e) => setNewClient(e.target.value)}
            placeholder="New client's name"
            aria-label="New client's name"
            autoFocus
            className="fld" style={{ width: '12rem', minHeight: 34 }}
          />
          <button
            type="button"
            disabled={pending || newClient.trim().length < 2}
            onClick={() => run(() => copyQuoteAction(quoteId, 'template', newClient))}
            className="btn sec sm"
          >
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

      {canPrint ? (
        <Link href={`/studio/quotations/${quoteId}/print`} target="_blank" className={status === 'DRAFT' ? 'btn sec' : 'btn pri'}>
          <LineIcon name="eye" size={16} />
          Print / PDF
        </Link>
      ) : null}
    </div>
  );
}
