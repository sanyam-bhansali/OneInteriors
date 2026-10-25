'use client';

import { useState, useTransition } from 'react';
import { checkDelayAction } from './actions';

/** "Checked": the owner, a PM or the design head has looked at the reason. */
export function CheckButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn ghost sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await checkDelayAction(id);
            setError(r.ok ? null : r.error);
          })
        }
      >
        Checked
      </button>
      {error ? (
        <span role="alert" className="bad-t sm">
          {' '}
          {error}
        </span>
      ) : null}
    </>
  );
}
