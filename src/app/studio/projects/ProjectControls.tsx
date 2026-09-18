'use client';

import { useActionState, useState, useTransition } from 'react';
// Pure module — see the note in Board.tsx. CONTRIBUTING §9.5.
import {
  PROJECT_STAGES,
  PROJECT_STAGE_LABELS,
  type ProjectStageName,
} from '@/modules/studio-practice/vocabulary';
import { addProjectAction, setStageAction } from './actions';
import { IDLE } from '../form-state';

const input =
  'rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14px] text-[var(--s-ink)] placeholder:text-[var(--s-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]';
const primary =
  'rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[14px] font-medium text-white hover:bg-[var(--s-accent-deep)] disabled:opacity-40';
const quiet =
  'rounded-[8px] border border-[var(--s-rule)] px-3 py-1.5 text-[13px] font-medium hover:border-[var(--s-ink-3)] disabled:opacity-40';

/**
 * Starting a project.
 *
 * Only clients already marked booked or on site appear. A project without a
 * client is an orphan, and letting one be created from an enquiry would mean
 * the board and this page disagreed about whether the job had been won.
 */
export function NewProject({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addProjectAction, IDLE);

  if (clients.length === 0) return null;

  if (!open) {
    return (
      <div className="relative">
        <button type="button" onClick={() => setOpen(true)} className={primary}>
          + New project
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <form action={action} className="s-card absolute right-0 top-full z-20 mt-2 flex w-[min(27rem,calc(100vw-2rem))] flex-col gap-3 p-5 shadow-lg">
        <p className="m-0 text-[15px] font-semibold">New project</p>

        <label className="flex flex-col gap-1.5">
          <span className="s-label">Client</span>
          <select name="clientId" required className={input}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="s-label">Project name — optional</span>
          <input name="name" placeholder="Kothari Residence" className={input} />
        </label>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="s-label">Contract ₹ — optional</span>
            <input name="contract" inputMode="decimal" placeholder="1850000" className={`${input} s-num text-right`} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="s-label">Target date</span>
            <input type="date" name="targetDate" className={input} />
          </label>
        </div>

        <p className="m-0 text-[12.5px] leading-snug text-[var(--s-ink-3)]">
          The contract figure is frozen here. Every later number is measured against it, so editing
          a quotation afterwards will not move it.
        </p>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={primary}>
            {pending ? 'Creating…' : 'Create'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={quiet}>
            Cancel
          </button>
        </div>

        {'ok' in state && !state.ok ? (
          <p role="alert" className="m-0 text-[12.5px] text-[var(--s-bad)]">{state.error}</p>
        ) : null}
      </form>
    </div>
  );
}

/** One click along the five stages. */
export function StageMover({ projectId, stage }: { projectId: string; stage: ProjectStageName }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const index = PROJECT_STAGES.indexOf(stage);
  const next = index < PROJECT_STAGES.length - 1 ? PROJECT_STAGES[index + 1] : null;
  if (!next) return null;

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await setStageAction(projectId, next);
            setError(result && 'ok' in result && !result.ok ? result.error : null);
          })
        }
        className={quiet}
      >
        → {PROJECT_STAGE_LABELS[next]}
      </button>
      {error ? <span className="text-[12.5px] text-[var(--s-bad)]">{error}</span> : null}
    </>
  );
}
