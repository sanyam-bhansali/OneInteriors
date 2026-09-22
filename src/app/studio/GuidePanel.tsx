'use client';

/**
 * The walkthrough panel.
 *
 * Sits at the top of Leads and Quotations. Three steps, each ticked from the
 * studio's own data rather than from a button somebody pressed — see
 * `modules/studio/guide.ts` for why that is the whole point.
 *
 * ## Open, closed, and gone
 *
 * It opens by itself the first time and stays open while anything is
 * outstanding. "Skip" collapses it to a single line that can be pressed to
 * bring it back, so nothing is ever permanently hidden by an accidental
 * press. Once every step is done it stops opening on its own for good — a
 * finished checklist that keeps greeting you is clutter.
 *
 * ## Why the next step is highlighted rather than the first
 *
 * Somebody who priced their catalogue before filling in their studio details
 * should be pointed at the details. Ordering a checklist by the order we
 * imagined and then pointing at step one regardless is how a guide starts
 * arguing with the person using it.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  GUIDES,
  progressFor,
  completedCount,
  allDone,
  type GuideId,
  type StudioFacts,
} from '@/modules/studio/guide';
import { dismissGuideAction } from './guide-actions';

function Tick({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className="mt-[3px] flex h-[19px] w-[19px] flex-none items-center justify-center rounded-full border text-[11px] font-bold"
      style={
        done
          ? {
              borderColor: 'var(--color-ontrack)',
              background: 'var(--color-ontrack)',
              color: '#fff',
            }
          : { borderColor: 'var(--s-rule)', color: 'transparent' }
      }
    >
      ✓
    </span>
  );
}

export function GuidePanel({
  guide,
  facts,
  dismissed,
}: {
  guide: GuideId;
  facts: StudioFacts;
  dismissed: boolean;
}) {
  const def = GUIDES[guide];
  const progress = progressFor(guide, facts);
  const finished = allDone(progress);
  const done = completedCount(progress);

  /* Server state decides the first render; local state lets a press feel
     instant rather than waiting on a round trip for a panel. */
  const [open, setOpen] = useState(!dismissed && !finished);
  const [, start] = useTransition();

  const toggle = (next: boolean) => {
    setOpen(next);
    start(() => {
      void dismissGuideAction(guide, !next);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => toggle(true)}
        className="mb-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-4 text-[13.5px] font-medium text-[var(--s-ink-2)] hover:text-[var(--s-ink)]"
      >
        <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.08em]">
          {done}/{def.steps.length}
        </span>
        Show me how this works
      </button>
    );
  }

  const nextId = progress.find((p) => !p.done)?.stepId ?? null;

  return (
    <section
      aria-label={def.title}
      className="mb-6 rounded-[14px] border border-[var(--s-rule)] bg-[var(--s-surface)] p-6"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="label m-0 mb-2">
            {finished ? 'All done' : `Step ${done + 1} of ${def.steps.length}`}
          </p>
          <h2 className="m-0 text-[19px] font-semibold leading-tight text-[var(--s-ink)]">
            {finished ? def.done : def.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => toggle(false)}
          className="min-h-11 cursor-pointer border-0 bg-transparent px-1 text-[13px] text-[var(--s-ink-3)] underline hover:text-[var(--s-ink)]"
        >
          {finished ? 'Hide this' : 'Skip'}
        </button>
      </div>

      {!finished ? (
        <p className="m-0 mb-5 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--s-ink-2)]">
          {def.intro}
        </p>
      ) : null}

      <ol className="m-0 flex list-none flex-col gap-0 p-0">
        {def.steps.map((step) => {
          const isDone = progress.find((p) => p.stepId === step.id)?.done ?? false;
          const isNext = step.id === nextId;

          return (
            <li
              key={step.id}
              className="flex items-start gap-3 border-t border-[var(--s-rule)] py-3.5 first:border-t-0 first:pt-0"
              style={{ opacity: isDone ? 0.62 : 1 }}
            >
              <Tick done={isDone} />
              <div className="min-w-0 flex-1">
                <p
                  className="m-0 text-[14.5px] leading-snug text-[var(--s-ink)]"
                  style={{
                    fontWeight: isNext ? 600 : 500,
                    textDecoration: isDone ? 'line-through' : undefined,
                  }}
                >
                  {step.title}
                </p>
                {!isDone ? (
                  <p className="m-0 mt-1 max-w-[58ch] text-[13.5px] leading-snug text-[var(--s-ink-2)]">
                    {step.why}
                  </p>
                ) : null}
              </div>

              {!isDone && step.href ? (
                <Link
                  href={step.href}
                  className="inline-flex min-h-11 flex-none items-center rounded-[10px] px-4 text-[13.5px] font-medium no-underline"
                  style={
                    isNext
                      ? { background: 'var(--s-ink)', color: 'var(--s-surface)' }
                      : { border: '1px solid var(--s-rule)', color: 'var(--s-ink)' }
                  }
                >
                  {step.cta ?? 'Open'}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
