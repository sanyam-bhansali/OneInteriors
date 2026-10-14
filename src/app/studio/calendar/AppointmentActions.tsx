'use client';

import { useState, useTransition } from 'react';
import { confirmAction, completeAction, cancelAction } from './actions';
import type { AppointmentStatusName } from '@/modules/studio/appointment-rules';

/**
 * The buttons on an appointment.
 *
 * Which ones exist is decided here from the status, and the module decides
 * again on the way in — the same rule enforced twice on purpose. A UI that only
 * shows legal actions is a courtesy; a server that only accepts legal ones is
 * the actual guarantee, since a server action is directly invocable.
 */
export function AppointmentActions({
  id,
  status,
  passed,
}: {
  id: string;
  status: AppointmentStatusName;
  passed: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? 'That did not work.');
    });
  }

  if (status === 'COMPLETED' || status === 'NO_SHOW' || status === 'CANCELLED') return null;

  return (
    <div className="hstack" style={{ gap: 8 }}>
      {/* Confirming a slot that has already been and gone is not a useful
          offer — the only sensible moves on a lapsed proposal are cancelling it
          or asking us for a new time. */}
      {status === 'PROPOSED' && !passed ? (
        <Button onClick={() => run(() => confirmAction(id))} pending={pending} primary>
          Confirm this time
        </Button>
      ) : null}

      {status === 'PROPOSED' && passed ? (
        <span className="muted sm">
          This time has passed without being confirmed.
        </span>
      ) : null}

      {status === 'CONFIRMED' && passed ? (
        <Button onClick={() => run(() => completeAction(id))} pending={pending} primary>
          It happened
        </Button>
      ) : null}

      <Button onClick={() => run(() => cancelAction(id))} pending={pending}>
        Cancel
      </Button>

      {/* Deliberately no "they did not turn up" button. That fact lands in a
          delivery record, both sides will have a view of it, and letting one
          party write the other's absence into a permanent record is how a
          marketplace earns a reputation for being unfair. It goes through a
          person. */}
      {status === 'CONFIRMED' && passed ? (
        <span className="muted sm">
          Nobody came? Tell us — we record that one, so both sides are heard.
        </span>
      ) : null}

      {error ? (
        <span role="alert" className="ox-err">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function Button({
  onClick,
  pending,
  primary = false,
  children,
}: {
  onClick: () => void;
  pending: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={primary ? 'btn pri sm' : 'btn ghost sm'}
    >
      {children}
    </button>
  );
}
