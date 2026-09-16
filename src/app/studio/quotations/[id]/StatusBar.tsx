'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { setStatusAction } from '../actions';
import type { QuoteStatusName } from '@/modules/studio-quote/quotes';

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
}: {
  quoteId: string;
  status: QuoteStatusName;
  canPrint: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

      {canPrint ? (
        <Link href={`/studio/quotations/${quoteId}/print`} target="_blank" className={primary}>
          Print / PDF
        </Link>
      ) : null}
    </div>
  );
}
