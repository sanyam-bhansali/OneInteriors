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

const quiet = 'btn sec sm';

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
    <li className="card" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', padding: '14px 18px' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{row.name}</p>
        {row.phone ? <span className="mono muted sm">{row.phone}</span> : null}
      </div>

      <span
        className={`chip xs ${soon ? 'warn' : ''}`}
      >
        {row.daysLeft === 0
          ? 'Erasing now'
          : `${row.daysLeft} ${row.daysLeft === 1 ? 'day' : 'days'} left`}
        {' · goes '}
        {row.erasesOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </span>

      <div className="hstack" style={{ marginLeft: 'auto', gap: 8 }}>
        <button type="button" disabled={busy} onClick={() => run(restoreAction)} className={quiet}>
          {busy ? 'Working…' : 'Restore'}
        </button>

        {asking ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(eraseAction)}
              className="btn sec sm bad-b"
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
            className="btn ghost xs"
          >
            Delete forever
          </button>
        )}
      </div>

      {error ? (
        <p role="alert" className="cl-err" style={{ width: '100%' }}>{error}</p>
      ) : null}
    </li>
  );
}

export function BinList({ rows }: { rows: BinnedRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="empty">
        <b>Nothing deleted.</b>
        <p className="muted" style={{ margin: 0, maxWidth: '58ch', lineHeight: 1.5 }}>
          When you delete a client they wait here for {BIN_DAYS} days before they go for good, so a
          delete is never the end of it.
        </p>
      </div>
    );
  }

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
    </ul>
  );
}
