'use client';

import { useState, useTransition } from 'react';
import { DOC_KINDS } from '@/modules/portal/documents';
import { materialCodeAction, removeDraftAction, shareDocumentAction, uploadDocumentAction } from './money-actions';

/**
 * The Home locker card's controls (studio workspace Phase 5): upload a
 * drawing (shared now, or a draft only the team sees), a new version of one
 * already there, share a draft, remove a draft, and a material's product
 * code once ordered.
 */

const field = 's-input w-full';
const small = 'text-[12.5px]';

function useRun() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string, after?: () => void) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      setMessage(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? 'Could not save.' });
      if (r.ok) after?.();
    });
  return { pending, message, run };
}

function Message({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return (
    <span role={m.ok ? 'status' : 'alert'} className={`${small} ${m.ok ? 'text-[var(--s-good)]' : 'text-[var(--s-bad)]'}`}>
      {m.text}
    </span>
  );
}

/** Upload a document, or (with `replaces`) the next version of one. */
export function UploadDocument({ projectId, customer, replaces }: { projectId: string; customer: string; replaces?: { id: string; title: string } }) {
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState(true);
  const { pending, message, run } = useRun();
  if (!open) {
    return (
      <span className="flex flex-col gap-1">
        <button type="button" className={replaces ? `${small} self-start text-[var(--s-accent)] underline` : 's-btn-ghost self-start'} onClick={() => setOpen(true)}>
          {replaces ? 'Upload a new version' : 'Upload drawings'}
        </button>
        <Message m={message} />
      </span>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-[10px] border border-[var(--s-rule)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        data.set('projectId', projectId);
        data.set('share', share ? 'true' : 'false');
        if (replaces) data.set('supersedesId', replaces.id);
        run(
          () => uploadDocumentAction(data),
          share ? `In ${customer}'s locker now.` : 'Saved as a draft. Only your team can see it.',
          () => {
            form.reset();
            setOpen(false);
          },
        );
      }}
    >
      {replaces ? (
        <p className={`m-0 ${small} text-[var(--s-ink-2)]`}>New version of {replaces.title}. The one before stays in the record.</p>
      ) : (
        <>
          <select name="kind" defaultValue="DRAWINGS" className={field} aria-label="Kind of document">
            {Object.entries(DOC_KINDS)
              .filter(([k]) => k !== 'RECEIPT')
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
          <input name="title" maxLength={100} className={field} placeholder="Title, e.g. Kitchen elevations" aria-label="Title" />
        </>
      )}
      <input type="file" name="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className={small} aria-label="The file" />
      <label className={`flex items-center gap-2 ${small} text-[var(--s-ink-2)]`}>
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
        Share with {customer} now
      </label>
      {!share ? <p className={`m-0 ${small} text-[var(--s-ink-3)]`}>A draft stays with your team until you share it.</p> : <p className={`m-0 ${small} text-[var(--s-ink-3)]`}>Once shared it cannot be removed, only replaced by a new version.</p>}
      <div className="flex gap-2">
        <button type="submit" className="s-btn" disabled={pending}>
          {pending ? 'Uploading…' : share ? 'Upload and share' : 'Upload as draft'}
        </button>
        <button type="button" className="s-btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <Message m={message} />
    </form>
  );
}

/** A draft's buttons: share it with the customer, or take it off. */
export function DraftActions({ projectId, documentId, customer }: { projectId: string; documentId: string; customer: string }) {
  const { pending, message, run } = useRun();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" className={`${small} text-[var(--s-accent)] underline`} disabled={pending} onClick={() => run(() => shareDocumentAction(projectId, documentId), `Shared. ${customer} can open it now.`)}>
        Share with {customer}
      </button>
      <button type="button" className={`${small} text-[var(--s-ink-3)] underline`} disabled={pending} onClick={() => run(() => removeDraftAction(projectId, documentId), 'Draft removed.')}>
        Remove draft
      </button>
      <Message m={message} />
    </span>
  );
}

/** A material's product code, added when it is ordered. */
export function MaterialCode({ projectId, materialId, code, ordered }: { projectId: string; materialId: string; code: string | null; ordered: boolean }) {
  const [value, setValue] = useState(code ?? '');
  const [isOrdered, setOrdered] = useState(ordered);
  const { pending, message, run } = useRun();
  const dirty = value.trim() !== (code ?? '') || isOrdered !== ordered;
  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <input className="s-input w-[10rem]" value={value} maxLength={60} onChange={(e) => setValue(e.target.value)} placeholder="Product code" aria-label="Product code" />
        <label className={`flex items-center gap-1.5 ${small} text-[var(--s-ink-2)]`}>
          <input type="checkbox" checked={isOrdered} onChange={(e) => setOrdered(e.target.checked)} />
          Ordered
        </label>
        {dirty ? (
          <button type="button" className="s-btn-ghost" disabled={pending} onClick={() => run(() => materialCodeAction(projectId, materialId, value, isOrdered || value.trim() !== ''), 'Saved.')}>
            Save
          </button>
        ) : null}
      </span>
      <Message m={message} />
    </span>
  );
}
