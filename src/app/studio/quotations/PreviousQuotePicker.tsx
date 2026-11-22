'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { formatINR } from '@/lib/money';
import type { PreviousQuote, PreviousQuoteCopy } from '@/modules/studio-quote/from-previous';
import { previousQuoteAction, previousQuotesAction } from './actions';

export type PickedQuote = Extract<PreviousQuoteCopy, { ok: true }>;

/**
 * "Start from a previous quotation" (owner, 17 Nov 2026), in both builders:
 * search the studio's own earlier quotations (only the ones this person can
 * see) by client, number, society or BHK, pick one, and see what comes
 * across — its lines and terms, never its client — and which product master
 * prices have changed since. The copy keeps the old rates; the builder edits
 * them like any line.
 */
export function PreviousQuotePicker({
  picked,
  pickedLabel,
  onPick,
  onClear,
  compact = false,
}: {
  picked: PickedQuote | null;
  /** Who the picked one was for, when it arrived already picked ("Use as template"). */
  pickedLabel?: string;
  onPick: (q: PickedQuote, row: PreviousQuote) => void;
  onClear: () => void;
  /** The First quote page's narrow side column. */
  compact?: boolean;
}) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<PreviousQuote[]>([]);
  const [row, setRow] = useState<PreviousQuote | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, start] = useTransition();
  const asked = useRef(0);

  /* The latest ones on open, then whatever is typed; an older answer arriving late is dropped. */
  useEffect(() => {
    if (picked) return;
    const n = (asked.current += 1);
    const t = setTimeout(() => {
      previousQuotesAction(text)
        .then((r) => {
          if (n !== asked.current) return;
          setRows(r);
          setLoaded(true);
        })
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [text, picked]);

  function pick(r: PreviousQuote) {
    setError('');
    start(async () => {
      try {
        const q = await previousQuoteAction(r.id);
        if (!q.ok) return setError(q.error);
        setRow(r);
        onPick(q, r);
      } catch {
        setError('That did not load. Check your connection and try again.');
      }
    });
  }

  if (picked) {
    return (
      <div className="qnote good" style={{ display: 'block' }}>
        <p style={{ margin: 0 }}>
          Copying <b>{picked.number}</b>
          {row ? ` (${[row.clientName, row.society, row.config].filter(Boolean).join(' · ')})` : pickedLabel ? ` (${pickedLabel})` : ''}: {picked.lines.length} lines and its terms, for this new
          client. Its client details, status and revisions are not copied.{' '}
          <button
            type="button"
            className="linkbtn"
            style={{ textDecoration: 'underline' }}
            onClick={() => {
              setRow(null);
              onClear();
            }}
          >
            Pick another
          </button>
        </p>
        {picked.changed.length > 0 ? (
          <p className="sm" style={{ margin: '6px 0 0' }}>
            {picked.changed.length === 1 ? '1 price has' : `${picked.changed.length} prices have`} changed in your product master since. The copy keeps the old
            price; change it in the builder if needed:{' '}
            {picked.changed
              .slice(0, 6)
              .map((c) => `${c.product} ${formatINR(c.wasPaise)} → ${formatINR(c.nowPaise)}`)
              .join(', ')}
            {picked.changed.length > 6 ? ` and ${picked.changed.length - 6} more` : ''}.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className={compact ? 'fld hfld' : 'fld'}
        aria-label="Search previous quotations — client, quote number, society or BHK"
        placeholder="Client, quote no., society or BHK"
        value={text}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
      />
      {rows.length > 0 ? (
        <ul className="pick qfound" style={{ position: 'static', marginTop: 4 }}>
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" disabled={busy} onClick={() => pick(r)}>
                <span style={{ fontWeight: 600 }}>
                  {r.number} · {r.clientName}
                </span>
                <span className="muted sm">
                  {[r.society, r.config, `${r.lineCount} lines`, formatINR(r.totalPaise), r.stage === 'DESIGN' ? 'Design Final' : null].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : !loaded ? null : (
        <p className="muted sm" style={{ margin: '4px 0 0' }}>
          {text.trim() ? 'No quotation of yours matches that.' : 'No quotations to copy yet.'}
        </p>
      )}
      {busy ? <p className="muted sm" style={{ margin: '4px 0 0' }}>Loading…</p> : null}
      {error ? (
        <p role="alert" className="qerr">
          {error}
        </p>
      ) : null}
    </div>
  );
}
