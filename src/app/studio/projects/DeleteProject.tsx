'use client';

import { useState, useTransition } from 'react';
import { deleteProjectAction, restoreProjectAction } from './actions';

/**
 * Delete a project (owner, 27 Oct 2026; studio/project-delete.ts): typed
 * confirmation with the client's name, an optional reason. Nothing is
 * erased; Projects → Deleted projects restores it.
 */
export function DeleteProject({ projectId, client }: { projectId: string; client: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const matches = typed.trim().replace(/\s+/g, ' ').toLowerCase() === client.trim().replace(/\s+/g, ' ').toLowerCase();

  if (!open) {
    return (
      <section className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <b className="sm">Delete this project</b>
        <span className="muted sm">For a mistake or a duplicate. It leaves every list and {client}&rsquo;s app; you can restore it.</span>
        <button type="button" className="btn ghost sm bad-b" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>
          Delete project
        </button>
      </section>
    );
  }
  return (
    <section className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderColor: 'var(--bad-s)' }}>
      <b className="sm bad-t">Delete {client}&rsquo;s project?</b>
      <span className="muted sm">
        It leaves every studio list and {client}&rsquo;s app, and their app link stops working. The sales final is free to start a new project from, and the lead goes back to before
        booking. Payments recorded stay in its history; to give money back, use Refund booking on the lead. Restore it from Deleted projects.
      </span>
      <label className="ox-f">
        <span className="lbl">Type {client} to confirm</span>
        <input className="fld" aria-label={`Type ${client} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </label>
      <label className="ox-f">
        <span className="lbl">Why (optional)</span>
        <input className="fld" aria-label="Why (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Duplicate, made by mistake, client went elsewhere" />
      </label>
      {error ? (
        <p role="alert" className="ox-err" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div className="hstack" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn sm bad-b"
          disabled={!matches || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await deleteProjectAction(projectId, typed, reason);
              if (!r.ok) {
                setError(r.error);
                return;
              }
              window.location.assign('/studio/projects?deleted=1');
            })
          }
        >
          {pending ? 'Deleting…' : 'Yes, delete it'}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </section>
  );
}

/** Restore on the Deleted projects page. */
export function RestoreProject({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        type="button"
        className="btn ghost sm"
        disabled={pending || said?.ok === true}
        onClick={() =>
          start(async () => {
            const r = await restoreProjectAction(projectId);
            /* Open it: the list refreshes without it, so a message here would vanish with the row. */
            if (r.ok) window.location.assign(`/studio/projects/${projectId}?restored=1`);
            else setSaid({ ok: false, text: r.error });
          })
        }
      >
        {pending ? 'Restoring…' : said?.ok ? 'Restored' : 'Restore'}
      </button>
      {said ? (
        <span role={said.ok ? 'status' : 'alert'} className={`sm ${said.ok ? 'good-t' : 'bad-t'}`} style={{ maxWidth: 360, textAlign: 'right' }}>
          {said.text}
        </span>
      ) : null}
    </span>
  );
}
