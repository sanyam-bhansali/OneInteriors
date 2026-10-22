'use client';

/**
 * The buttons on a quotation request (owner, 22 Oct 2026; docs/studio-os/
 * QUOTE-REQUESTS.md): Open (the builder lands on the draft), Mark done,
 * and for a head, hand it to someone else or cancel it. Each says what
 * happened right under it (SalesUi `Said`).
 */

import { useState } from 'react';
import { Said, useAct } from '../../SalesUi';
import { cancelRequestAction, finishRequestAction, reassignRequestAction, startRequestAction } from './actions';

export function OpenRequest({ requestId, started }: { requestId: string; started: boolean }) {
  const act = useAct();
  return (
    <span>
      <button type="button" className="btn pri sm" disabled={act.pending} onClick={() => act.run(() => startRequestAction(requestId))}>
        {act.pending ? 'Opening…' : started ? 'Continue →' : 'Open and build →'}
      </button>
      <Said result={act.result} />
    </span>
  );
}

export function FinishRequest({ requestId, clientId }: { requestId: string; clientId?: string }) {
  const act = useAct();
  return (
    <span>
      <button
        type="button"
        className="btn sec sm"
        disabled={act.pending}
        onClick={() => {
          if (window.confirm('Mark this request done without sending the quotation from here?')) act.run(() => finishRequestAction(requestId, clientId));
        }}
      >
        Mark done
      </button>
      <Said result={act.result} />
    </span>
  );
}

export function ReassignRequest({
  requestId,
  clientId,
  currentId,
  builders,
  allowCancel,
  reassign = true,
}: {
  requestId: string;
  clientId?: string;
  currentId: string | null;
  builders: { id: string; name: string }[];
  allowCancel: boolean;
  /** False: only the cancel button (whoever asked may cancel, not hand over). */
  reassign?: boolean;
}) {
  const others = builders.filter((b) => b.id !== currentId);
  const [to, setTo] = useState(others[0]?.id ?? '');
  const act = useAct();
  return (
    <div>
      <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
        {!reassign ? null : others.length > 0 ? (
          <>
            <label className="sr-only" htmlFor={`rq-${requestId}`}>
              Give it to
            </label>
            <select id={`rq-${requestId}`} className="fld" style={{ width: 'auto', minWidth: 140 }} value={to} onChange={(e) => setTo(e.target.value)}>
              {others.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn sec sm" disabled={act.pending || !to} onClick={() => act.run(() => reassignRequestAction(requestId, to, clientId))}>
              {currentId ? 'Hand over' : 'Give it'}
            </button>
          </>
        ) : (
          <span className="muted sm">Nobody else builds quotations.</span>
        )}
        {allowCancel ? (
          <button
            type="button"
            className="btn sec sm"
            disabled={act.pending}
            onClick={() => {
              if (window.confirm('Cancel this quotation request?')) act.run(() => cancelRequestAction(requestId, clientId));
            }}
          >
            Cancel request
          </button>
        ) : null}
      </div>
      <Said result={act.result} />
    </div>
  );
}
