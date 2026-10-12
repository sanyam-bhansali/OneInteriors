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
      <button type="button" onClick={() => toggle(true)} className="btn sec" style={{ alignSelf: 'flex-start', marginBottom: 4 }}>
        <span className="mono sm">
          {done}/{def.steps.length}
        </span>
        Show me how this works
      </button>
    );
  }

  const nextId = progress.find((p) => !p.done)?.stepId ?? null;

  return (
    <section aria-label={def.title} className="card" style={{ marginBottom: 4 }}>
      <div className="chead" style={{ alignItems: 'flex-start' }}>
        <div>
          <span className="eyebrow">{finished ? 'All done' : `Step ${done + 1} of ${def.steps.length}`}</span>
          <h2>{finished ? def.done : def.title}</h2>
        </div>
        <button type="button" onClick={() => toggle(false)} className="btn ghost sm">
          {finished ? 'Hide this' : 'Skip'}
        </button>
      </div>

      {!finished ? (
        <p className="muted" style={{ margin: 0, maxWidth: '62ch', fontSize: 14.5, lineHeight: 1.5 }}>
          {def.intro}
        </p>
      ) : null}

      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {def.steps.map((step, i) => {
          const isDone = progress.find((p) => p.stepId === step.id)?.done ?? false;
          const isNext = step.id === nextId;

          return (
            <li
              key={step.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px minmax(0,1fr) auto',
                gap: 14,
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                background: 'var(--soft)',
                boxShadow: isNext ? 'inset 0 0 0 2px var(--acc)' : undefined,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  background: isDone ? 'var(--good-s)' : isNext ? 'var(--acc)' : 'var(--fill2)',
                  color: isDone || isNext ? 'var(--paper)' : 'var(--ink)',
                }}
              >
                {isDone ? '✓' : i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 15, fontWeight: isNext ? 600 : 500, textDecoration: isDone ? 'line-through' : undefined, color: isDone ? 'var(--muted)' : undefined }}>{step.title}</b>
                {!isDone ? <div className="muted sm">{step.why}</div> : null}
              </div>

              {!isDone && step.href ? (
                <Link href={step.href} className={isNext ? 'btn acc sm' : 'btn ghost sm'}>
                  {step.cta ?? 'Open'}
                </Link>
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
