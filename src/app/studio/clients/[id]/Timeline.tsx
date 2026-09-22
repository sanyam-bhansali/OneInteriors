'use client';

import type { EventRow } from '@/modules/studio-practice/events';
import { ago, KIND_LABELS, toneFor } from '@/modules/studio-practice/event-copy';

/**
 * A lead's history, newest first.
 *
 * ## Why every line already has its words
 *
 * `summary` is written when the event happens and rendered verbatim here.
 * Nothing on this screen re-derives a sentence from `meta`, because a stage
 * rename would then retroactively change what the timeline says happened —
 * and a record that edits itself to match the present is not a record.
 *
 * That is also why `byName` is read rather than joined to the member. Two
 * years of history should not turn into "Unknown" the day somebody leaves.
 *
 * ## Tone is not severity
 *
 * LOST is not red. Losing a lead is an ordinary outcome of doing the work,
 * and a timeline that scolds a studio every time they record one teaches
 * them to stop recording — which costs us the only data that explains why
 * leads go.
 */
export function Timeline({ rows }: { rows: EventRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="m-0 text-[13.5px] text-[var(--s-ink-3)]">
        Nothing recorded yet. Logging a call or moving this along will show up here.
      </p>
    );
  }

  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {rows.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          {/* The rail, drawn per-row rather than as one absolute element, so
              it stops at the last entry instead of trailing into nothing. */}
          {i < rows.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute left-[5px] top-4 bottom-0 w-px bg-[var(--s-rule)]"
            />
          ) : null}

          <span
            aria-hidden="true"
            className={`relative z-10 mt-1.5 h-[11px] w-[11px] flex-none rounded-full border-2 border-[var(--s-surface)] ${dot(
              toneFor(e.kind),
            )}`}
          />

          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13.5px] leading-snug text-[var(--s-ink)]">{e.summary}</p>
            <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--s-ink-3)]">
              <span className="s-label normal-case tracking-normal">{KIND_LABELS[e.kind]}</span>
              <span aria-hidden="true">·</span>
              {/* The exact moment lives in the title, for the once a month
                  somebody needs it. Relative on the face, because a timeline
                  is read as a sequence and a date makes you do arithmetic. */}
              <time dateTime={e.createdAt.toISOString()} title={e.createdAt.toLocaleString('en-IN')}>
                {ago(e.createdAt)}
              </time>
              {/* "One Interiors" rather than a blank, so the studio can always
                  tell which half of their own history they did. */}
              <span aria-hidden="true">·</span>
              <span>{e.actor === 'SYSTEM' ? 'One Interiors' : (e.byName ?? 'Someone')}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function dot(tone: string): string {
  if (tone === 'good') return 'bg-[var(--s-good)]';
  if (tone === 'accent') return 'bg-[var(--s-accent)]';
  return 'bg-[var(--s-ink-3)]';
}
