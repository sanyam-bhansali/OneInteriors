'use client';

import { useState, useTransition } from 'react';
import { CATEGORY_WORDS, QUOTE_CATEGORIES, type QuoteCategory } from '@/modules/studio-quote/category-rules';
import { setQuoteCategoryAction } from '../actions';

/**
 * Essential, Premium or Luxe (the design meeting, 24 Oct 2026;
 * DESIGN-PROCESS-PLAN.md §4.3): the quotation's category, carried to the
 * Design Final and the project booked on it. Mandatory since 13 Nov 2026
 * (owner: "If it is not there, you cannot make a quotation"): it can be
 * changed, not cleared, and a quotation without one cannot be sent, revised,
 * marked sales final or converted. Older quotations without one say so here.
 */
export function CategoryPick({ quoteId, initial, canEdit }: { quoteId: string; initial: QuoteCategory | null; canEdit: boolean }) {
  const [value, setValue] = useState<string>(initial ?? '');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!canEdit) return value ? <span className="chip">{CATEGORY_WORDS[value as QuoteCategory]}</span> : null;
  const missing = value === '';
  return (
    <span className="hstack" style={{ gap: 6 }}>
      <select
        aria-label="Category"
        aria-invalid={missing}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          if (!next) return;
          const before = value;
          setValue(next);
          setError(null);
          start(async () => {
            const r = await setQuoteCategoryAction(quoteId, next);
            if (!r.ok) {
              setValue(before);
              setError(r.error);
            }
          });
        }}
        className="fld"
        style={{ width: 'auto', minHeight: 30, padding: '2px 8px', fontSize: 13, ...(missing ? { borderColor: 'var(--bad)', color: 'var(--bad)' } : {}) }}
      >
        {missing ? <option value="">Pick a category</option> : null}
        {QUOTE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_WORDS[c]}
          </option>
        ))}
      </select>
      {missing ? <span className="qerr sm">Needed before you send it</span> : null}
      {error ? <span className="qerr sm">{error}</span> : null}
    </span>
  );
}
