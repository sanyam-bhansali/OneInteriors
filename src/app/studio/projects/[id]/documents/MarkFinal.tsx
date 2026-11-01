'use client';

import { useState, useTransition } from 'react';
import { markFinalAction } from '../design-actions';

/**
 * "Mark as final" on one version in the repository (owner, 1 Nov 2026): any
 * version may be marked, an older one too; marking it clears the type's
 * other final. When the client has not approved it, the designer is asked
 * first. On the marked one, "Not final" takes the mark off.
 */
export function MarkFinal({ projectId, documentId, marked, warning }: { projectId: string; documentId: string; marked: boolean; warning: string | null }) {
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const go = (final: boolean) => {
    if (final && warning && !window.confirm(`${warning} Mark it final anyway?`)) return;
    start(async () => {
      const r = await markFinalAction(projectId, documentId, final);
      setSaid(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className="btn ghost sm" disabled={pending} onClick={() => go(!marked)}>
        {marked ? 'Not final' : 'Mark as final'}
      </button>
      {said ? (
        <span role={said.ok ? 'status' : 'alert'} className={`sm ${said.ok ? 'good-t' : 'bad-t'}`}>
          {said.text}
        </span>
      ) : null}
    </span>
  );
}
