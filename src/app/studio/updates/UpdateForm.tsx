'use client';

import { useState, useTransition } from 'react';
import { TRACKER_STAGES } from '@/modules/portal/tracker';
import { withShrunkPhotos } from '@/lib/shrink-image';
import { postStudioUpdateAction } from './actions';

const input = 'rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-[14px]';

/** Post what happened on site, with photos — the customer sees it in "Your home". */
export function UpdateForm({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        data.set('projectId', projectId);
        start(async () => {
          const r = await postStudioUpdateAction(await withShrunkPhotos(data));
          setMessage(r.ok ? 'Posted — your client can see it now.' : (r.error ?? 'Could not post.'));
          if (r.ok) {
            setNote('');
            form.reset();
          }
        });
      }}
    >
      <input
        name="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What happened — “Kitchen carcasses delivered to site”"
        className={`${input} min-w-[18rem] flex-1`}
      />
      <select name="stage" className={input} aria-label="Stage" defaultValue="">
        <option value="">No stage</option>
        {TRACKER_STAGES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple className="text-[12.5px]" aria-label="Site photos" />
      <button
        type="submit"
        disabled={pending || note.trim().length < 3}
        className="rounded-full border border-[var(--color-petrol)] px-4 py-1.5 text-[13px] text-[var(--color-petrol)] disabled:opacity-40"
      >
        {pending ? 'Posting…' : 'Post update'}
      </button>
      {message ? <p className="m-0 basis-full text-[13px] text-[var(--color-ink-2)]">{message}</p> : null}
    </form>
  );
}
