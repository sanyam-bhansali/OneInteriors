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
      <p className="cl-sub">
        Nothing recorded yet. Logging a call or moving this along will show up here.
      </p>
    );
  }

  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
      {rows.map((e) => (
        <li key={e.id} className="ev">
          <span aria-hidden="true" className="evi" style={glyphTone(toneFor(e.kind))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={glyph(toneFor(e.kind))} />
            </svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{e.summary}</p>
            <p className="muted sm" style={{ margin: '2px 0 0' }}>
              {KIND_LABELS[e.kind]} ·{' '}
              {/* The exact moment lives in the title; relative on the face, because a timeline is read as a sequence. */}
              <time dateTime={e.createdAt.toISOString()} title={e.createdAt.toLocaleString('en-IN')}>
                {ago(e.createdAt)}
              </time>{' '}
              · {e.actor === 'SYSTEM' ? 'One Interiors' : (e.byName ?? 'Someone')}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The row's mark: a tick for good news, an arrow for a step forward, a dot otherwise. */
function glyph(tone: string): string {
  if (tone === 'good') return 'm5 12 5 5 9-10';
  if (tone === 'accent') return 'M7 17 17 7M9 7h8v8';
  return 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z';
}

function glyphTone(tone: string): React.CSSProperties | undefined {
  if (tone === 'good') return { background: 'var(--good-bg)', color: 'var(--good)' };
  if (tone === 'accent') return { background: 'var(--acc-soft)', color: 'var(--acc-ink)' };
  return undefined;
}
