'use client';

import { useState, useTransition } from 'react';
import { setQuoteCategoryAction } from '../actions';

/**
 * Essential, Premium or Luxe (the design meeting, 24 Oct 2026;
 * DESIGN-PROCESS-PLAN.md §4.3): the quotation's category, carried to the
 * Design Final and the project booked on it.
 */
export function CategoryPick({ quoteId, initial, canEdit }: { quoteId: string; initial: 'ESSENTIAL' | 'PREMIUM' | 'LUXURY' | null; canEdit: boolean }) {
  const [value, setValue] = useState(initial ?? '');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const words: Record<string, string> = { ESSENTIAL: 'Essential', PREMIUM: 'Premium', LUXURY: 'Luxe' };
  if (!canEdit) return value ? <span className="chip">{words[value]}</span> : null;
  return (
    <span className="hstack" style={{ gap: 6 }}>
      <select
        aria-label="Category"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const before = value;
          setValue(next);
          setError(null);
          start(async () => {
            const r = await setQuoteCategoryAction(quoteId, next || null);
            if (!r.ok) {
              setValue(before);
              setError(r.error);
            }
          });
        }}
        className="fld"
        style={{ width: 'auto', minHeight: 30, padding: '2px 8px', fontSize: 13 }}
      >
        <option value="">Category: not set</option>
        <option value="ESSENTIAL">Essential</option>
        <option value="PREMIUM">Premium</option>
        <option value="LUXURY">Luxe</option>
      </select>
      {error ? <span className="qerr sm">{error}</span> : null}
    </span>
  );
}
