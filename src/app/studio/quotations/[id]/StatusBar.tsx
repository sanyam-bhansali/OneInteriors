'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { copyQuoteAction, deleteQuoteAction, setStatusAction } from '../actions';
import type { QuoteStageName, QuoteStatusName } from '@/modules/studio-quote/quotes';

const primary =
  'rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[14px] font-medium text-white no-underline hover:bg-[var(--s-accent-deep)] disabled:opacity-40';
const quiet =
  'rounded-[8px] border border-[var(--s-rule)] px-3.5 py-2 text-[13.5px] font-medium no-underline hover:border-[var(--s-ink-3)] disabled:opacity-40';

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
}: {
  quoteId: string;
  status: QuoteStatusName;
  canPrint: boolean;
  stage: QuoteStageName;
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

  const set = (next: QuoteStatusName) =>
    start(async () => {
      const result = await setStatusAction(quoteId, next);
      setError(result && 'ok' in result && !result.ok ? result.error : null);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <span className="text-[12.5px] text-[var(--s-bad)]">{error}</span> : null}

      {status === 'DRAFT' ? (
        <button type="button" disabled={pending || !canPrint} onClick={() => set('ISSUED')} className={quiet}>
          Mark as sent
        </button>
      ) : null}

      {status === 'ISSUED' ? (
        <>
          <button type="button" disabled={pending} onClick={() => set('ACCEPTED')} className={quiet}>
            Won
          </button>
          <button type="button" disabled={pending} onClick={() => set('DECLINED')} className={quiet}>
            Lost
          </button>
        </>
      ) : null}

      {status === 'ACCEPTED' || status === 'DECLINED' ? (
        <button type="button" disabled={pending} onClick={() => set('ISSUED')} className={quiet}>
          Reopen
        </button>
      ) : null}

      {basedOnId ? (
        <Link href={`/studio/quotations/${quoteId}/compare`} className={quiet}>
          Compare with Sales Final
        </Link>
      ) : null}

      {stage === 'SALES' && canPrint ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => copyQuoteAction(quoteId, 'design-final'))}
          className={quiet}
          title="A copy for after design sign-off; this Sales Final stays as sent"
        >
          Make Design Final
        </button>
      ) : null}

      {templating ? (
        <span className="flex items-center gap-1.5">
          <input
            value={newClient}
            onChange={(e) => setNewClient(e.target.value)}
            placeholder="New client's name"
            aria-label="New client's name"
            autoFocus
            className="w-[11rem] rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-2.5 py-1.5 text-[13.5px]"
          />
          <button
            type="button"
            disabled={pending || newClient.trim().length < 2}
            onClick={() => run(() => copyQuoteAction(quoteId, 'template', newClient))}
            className={quiet}
          >
            Copy
          </button>
          <button type="button" onClick={() => setTemplating(false)} className="text-[13px] text-[var(--s-ink-3)]">
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" disabled={pending} onClick={() => setTemplating(true)} className={quiet}>
          Use as template
        </button>
      )}

      {deletable ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => (confirmDelete ? run(() => deleteQuoteAction(quoteId)) : setConfirmDelete(true))}
          onBlur={() => setConfirmDelete(false)}
          className={`${quiet} ${confirmDelete ? '!border-[var(--s-bad)] !text-[var(--s-bad)]' : ''}`}
        >
          {confirmDelete ? 'Delete — press again' : 'Delete draft'}
        </button>
      ) : null}

      {canPrint ? (
        <Link href={`/studio/quotations/${quoteId}/print`} target="_blank" className={primary}>
          Print / PDF
        </Link>
      ) : null}
    </div>
  );
}
