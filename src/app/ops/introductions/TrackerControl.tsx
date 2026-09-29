'use client';

import { useState, useTransition } from 'react';
import { startTrackerAction, stageDoneAction, postUpdateAction } from './actions';
import { plannedStages, TRACKER_STAGES } from '@/modules/portal/tracker';
import type { OpsIntroduction } from '@/modules/studio/introduction-ops';

const input =
  'rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-[14px]';
const ghost =
  'rounded-full border border-[var(--color-rule)] px-4 py-1.5 text-[13px] text-[var(--color-ink)] hover:border-[var(--color-ink-3)] disabled:opacity-40';

/**
 * The customer's project tracker, from ops' side: start it when the customer
 * signs (which also records the win), tick stages as they finish, post what
 * happened. Everything here appears in the customer's "Your home".
 */
export function TrackerControl({ intro }: { intro: OpsIntroduction }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [stage, setStage] = useState('');
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.error ?? 'Could not save.'));
      if (r.ok) after?.();
    });

  if (!intro.project) {
    if (intro.withdrawnAt || intro.wonByOther) return null;
    return (
      <form
        className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--color-rule)] pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const day = String(new FormData(e.currentTarget).get('startOn') ?? '');
          run(() => startTrackerAction(intro.id, day));
        }}
      >
        <label className="text-[13px] text-[var(--color-ink-2)]">
          Signed? Start their project tracker from
          <input type="date" name="startOn" className={`${input} ml-2`} required />
        </label>
        <button type="submit" disabled={pending} className={ghost}>
          Start the tracker
        </button>
        {error ? <p className="m-0 basis-full text-[13px] text-[var(--color-atrisk)]">{error}</p> : null}
      </form>
    );
  }

  const planned = plannedStages(new Date(intro.project.startOn), intro.project.totalDays);
  return (
    <div className="mt-4 border-t border-[var(--color-rule)] pt-4">
      <p className="label m-0 mb-2">Project tracker — the customer sees this</p>
      <ul className="m-0 mb-3 flex list-none flex-col gap-1.5 p-0">
        {planned.map((s) => {
          const done = intro.project!.doneStages.includes(s.key);
          return (
            <li key={s.key} className="flex items-center gap-3 text-[14px]">
              <input
                type="checkbox"
                checked={done}
                disabled={pending}
                onChange={(e) => run(() => stageDoneAction(intro.project!.id, s.key, e.target.checked))}
                className="h-4 w-4 accent-[var(--color-petrol)]"
                aria-label={`${s.label} done`}
              />
              <span className={done ? 'text-[var(--color-ink-3)] line-through' : 'text-[var(--color-ink)]'}>{s.label}</span>
              <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-ink-3)]">
                by {s.targetOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </li>
          );
        })}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => postUpdateAction(intro.project!.id, note, stage || null), () => setNote(''));
        }}
      >
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What happened — “Kitchen carcasses delivered to site”"
          className={`${input} min-w-[18rem] flex-1`}
        />
        <select value={stage} onChange={(e) => setStage(e.target.value)} className={input} aria-label="Stage">
          <option value="">No stage</option>
          {TRACKER_STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending || note.trim().length < 3} className={ghost}>
          Post update
        </button>
      </form>
      {error ? <p className="m-0 mt-2 text-[13px] text-[var(--color-atrisk)]">{error}</p> : null}
    </div>
  );
}
