'use client';

import { useTransition } from 'react';
import { milestoneWarning, milestonesShown } from '@/modules/project/step-rules';
import type { PlanEditResult } from '@/modules/project/plan-edit';
import { starStepAction } from './plan-actions';

/**
 * Customer milestones (owner, 12 Oct 2026; docs/studio-os/CUSTOMER-MILESTONES.md):
 * the ★ beside a step on the Plan and Design tabs. A starred step is one of
 * its stage's milestones the client sees; every other step is the studio's
 * own. Owner or PM (`plan.edit`); others see the star but cannot press it.
 */
export function StarToggle({
  projectId,
  stepId,
  label,
  starred,
  canEdit,
  say,
}: {
  projectId: string;
  stepId: string;
  label: string;
  starred: boolean;
  canEdit: boolean;
  say: (r: PlanEditResult) => void;
}) {
  const [pending, start] = useTransition();
  const title = starred ? 'Starred: the client sees this step' : 'Not starred: only your team sees this step';
  const glyph = (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.9 1.1-5.9-4.4-4.1 6-.8z" />
    </svg>
  );
  const tone = starred ? 'text-[var(--s-accent)]' : 'text-[var(--s-ink-3)]';
  if (!canEdit) {
    return (
      <span className={`inline-flex h-9 w-9 flex-none items-center justify-center ${tone}`} title={title}>
        {glyph}
        <span className="sr-only">{starred ? '(starred, the client sees it)' : ''}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={starred ? `Unstar ${label}: hide it from the client` : `Star ${label}: show it to the client`}
      title={title}
      disabled={pending}
      onClick={() => start(async () => say(await starStepAction(projectId, stepId, !starred)))}
      className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-[8px] hover:bg-[var(--s-surface-2)] disabled:opacity-50 ${tone}`}
    >
      {glyph}
    </button>
  );
}

/** "2 shown to the client" and, when a stage has none or more than four, a soft warning. */
export function MilestoneCount({ n }: { n: number }) {
  const warn = milestoneWarning(n);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
      <span className="font-medium text-[var(--s-accent)]">★ {milestonesShown(n)}</span>
      {warn ? <span className="text-[var(--s-warn)]">{warn}</span> : null}
    </span>
  );
}

/** The short hint beside the stars. */
export const STAR_HINT = 'Starred steps are what the client sees. The rest are for your team.';
