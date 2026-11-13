'use client';

import { useState, useTransition } from 'react';
import { setOnSiteCarcassAction } from './carcass-actions';

/**
 * On-site carcass (owner, 13 Nov 2026: "which projects can we take manual?"):
 * the carcass is built on site and only the shutters come from the factory.
 * A chip in the project's header; the owner, the design head and the PM tap
 * it to set or clear it. Everyone else sees the chip only when it is set.
 */
export function CarcassToggle({ projectId, initial, canEdit }: { projectId: string; initial: boolean; canEdit: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!canEdit)
    return on ? (
      <span className="chip warn" data-testid="carcass-chip">
        On-site carcass (shutters from factory)
      </span>
    ) : null;
  const flip = () => {
    const next = !on;
    setOn(next);
    setError(null);
    start(async () => {
      const r = await setOnSiteCarcassAction(projectId, next);
      if (!r.ok) {
        setOn(!next);
        setError(r.error);
      }
    });
  };
  return (
    <>
      <button
        type="button"
        className={`chip ${on ? 'warn' : ''}`}
        aria-pressed={on}
        disabled={pending}
        onClick={flip}
        title={on ? 'Carcass built on site, only shutters from the factory. Tap to clear.' : 'Tap if the carcass is built on site and only the shutters come from the factory.'}
        style={{ cursor: 'pointer' }}
        data-testid="carcass-toggle"
      >
        {on ? 'On-site carcass (shutters from factory)' : '+ On-site carcass'}
      </button>
      {error ? (
        <span role="alert" className="chip bad">
          {error}
        </span>
      ) : null}
    </>
  );
}
