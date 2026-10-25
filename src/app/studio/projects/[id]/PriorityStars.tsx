'use client';

import { useState, useTransition } from 'react';
import { setProjectPriorityAction } from './design-actions';

/**
 * The project's priority, 1 to 5 stars (the design meeting, 24 Oct 2026;
 * DESIGN-PROCESS-PLAN.md §2.4): one value the whole studio sees; lists put
 * more stars first. The owner, the PM and the designer on the project set it;
 * tapping the current number clears it.
 */
export function PriorityStars({ projectId, initial, canEdit }: { projectId: string; initial: number | null; canEdit: boolean }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const set = (n: number) => {
    const next = value === n ? null : n;
    const before = value;
    setValue(next);
    start(async () => {
      const r = await setProjectPriorityAction(projectId, next);
      if (!r.ok) setValue(before);
    });
  };
  if (!canEdit) return value ? <span className="chip" title="Priority">{'★'.repeat(value)}</span> : null;
  return (
    <span className="chip" role="group" aria-label={`Priority: ${value ?? 'not set'} of 5`} style={{ gap: 0 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={pending}
          onClick={() => set(n)}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          aria-pressed={value !== null && n <= value}
          style={{ background: 'none', border: 0, padding: '0 1px', cursor: 'pointer', color: value !== null && n <= value ? 'var(--warn)' : 'var(--muted)', fontSize: 15, lineHeight: 1 }}
        >
          ★
        </button>
      ))}
    </span>
  );
}
