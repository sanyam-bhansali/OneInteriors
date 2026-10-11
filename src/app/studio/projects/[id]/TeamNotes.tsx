'use client';

import { useState, useTransition } from 'react';
import { saveTeamNotesAction } from './actions';

/** The team's own notes on a project. Never reaches the customer. */
export function TeamNotes({ projectId, initial, canEdit, max }: { projectId: string; initial: string; canEdit: boolean; max: number }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (!canEdit) {
    return <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--s-ink-2)]">{initial || 'No notes yet.'}</p>;
  }

  const save = () =>
    start(async () => {
      const r = await saveTeamNotesAction(projectId, text);
      if (r.ok) setSaved(text.trim());
      setMessage(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error ?? 'Could not save.' });
    });

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="team-notes" className="sr-only">
        Notes for your team
      </label>
      <textarea
        id="team-notes"
        value={text}
        maxLength={max}
        rows={5}
        onChange={(e) => {
          setText(e.target.value);
          setMessage(null);
        }}
        placeholder="Anything the site team should know: access, timings, who to call."
        className="w-full resize-y rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[13.5px] leading-relaxed"
      />
      <div className="flex items-center gap-3">
        <button type="button" className="s-btn-ghost" onClick={save} disabled={pending || text.trim() === saved.trim()}>
          {pending ? 'Saving…' : 'Save notes'}
        </button>
        {message ? (
          <span role="status" className={`text-[12.5px] ${message.ok ? 'text-[var(--s-good)]' : 'text-[var(--s-bad)]'}`}>
            {message.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
