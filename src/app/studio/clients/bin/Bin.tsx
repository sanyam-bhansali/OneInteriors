'use client';

import { useState, useTransition } from 'react';
import { BIN_DAYS } from '@/modules/studio-practice/vocabulary';
import type { BinnedRow } from '@/modules/studio-practice/clients';
import { restoreAction, eraseAction } from '../actions';
import type { State } from '../../form-state';

/**
 * The bin.
 *
 * ## Why restore is the loud button and erase is the quiet one
 *
 * Everything here is already deleted. The only reason somebody opens this
 * screen is to get something back — nobody visits a bin to delete harder. So
 * Restore is the obvious action on every row and "Delete forever" is small,
 * asks, and never appears in bulk.
 *
 * ## Why the date is on the row
 *
 * "In the bin" is not a state anybody tracks in their head. The row says the
 * day it goes, so a studio scanning this in week three can see what is about
 * to be lost rather than discovering it in week five.
 */

const quiet =
  'rounded-[8px] border border-[var(--s-rule)] px-3 py-1.5 text-[13px] font-medium hover:border-[var(--s-ink-3)] disabled:opacity-40';

function Row({ row }: { row: BinnedRow }) {
  const [busy, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: (ids: string[]) => Promise<State>) =>
    start(async () => {
      const result = await fn([row.id]);
      setError('ok' in result && !result.ok ? result.error : null);
    });

  // Rounded up in `myBin`, so 1 means "today, later on" rather than "gone".
  const soon = row.daysLeft <= 3;

  return (
    <li className="s-card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0">
        <p className="m-0 truncate text-[14.5px] font-medium">{row.name}</p>
        {row.phone ? <span className="s-num text-[12.5px] text-[var(--s-ink-3)]">{row.phone}</span> : null}
      </div>

      <span
        className={`text-[12.5px] ${soon ? 'font-medium text-[var(--s-accent)]' : 'text-[var(--s-ink-3)]'}`}
      >
        {row.daysLeft === 0
          ? 'Erasing now'
          : `${row.daysLeft} ${row.daysLeft === 1 ? 'day' : 'days'} left`}
        {' · goes '}
        {row.erasesOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => run(restoreAction)} className={quiet}>
          {busy ? 'Working…' : 'Restore'}
        </button>

        {asking ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(eraseAction)}
              className={`${quiet} !border-[var(--s-bad)] !text-[var(--s-bad)]`}
            >
              Yes, forever
            </button>
            <button type="button" onClick={() => setAsking(false)} className={quiet}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="text-[12.5px] text-[var(--s-ink-3)] underline hover:text-[var(--s-bad)]"
          >
            Delete forever
          </button>
        )}
      </div>

      {error ? (
        <p role="alert" className="m-0 w-full text-[12.5px] text-[var(--s-bad)]">{error}</p>
      ) : null}
    </li>
  );
}

export function BinList({ rows }: { rows: BinnedRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="s-card p-8">
        <p className="m-0 mb-2 text-[15.5px] font-semibold">Nothing deleted.</p>
        <p className="m-0 max-w-[58ch] text-[14.5px] leading-relaxed text-[var(--s-ink-2)]">
          When you delete a client they wait here for {BIN_DAYS} days before they go for good, so a
          delete is never the end of it.
        </p>
      </div>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
    </ul>
  );
}
