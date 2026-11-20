'use client';

/**
 * One booked visit's controls: move it to another slot, cancel it with a
 * reason the client reads (a paid visit is refunded in full first), or mark
 * it done. Owner, PM and the design head.
 */

import { useState, useTransition } from 'react';
import { cancelVisitAction, finishVisitAction, moveVisitAction } from './actions';

type Mode = null | 'move' | 'cancel' | 'done';

export function VisitActions({
  id,
  day,
  start,
  paid,
  charge,
  moveDays,
  starts,
}: {
  id: string;
  day: string;
  start: string;
  paid: boolean;
  charge: string;
  moveDays: { date: string; label: string }[];
  starts: { start: string; label: string }[];
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [newDay, setNewDay] = useState(day);
  const [newStart, setNewStart] = useState(start);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, go] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    go(async () => {
      const r = await fn();
      setMsg(r);
      if (r.ok) {
        setMode(null);
        setText('');
      }
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn sec sm" aria-pressed={mode === 'move'} onClick={() => setMode(mode === 'move' ? null : 'move')}>
          Move
        </button>
        <button type="button" className="btn sec sm" aria-pressed={mode === 'done'} onClick={() => setMode(mode === 'done' ? null : 'done')}>
          Mark done
        </button>
        <button type="button" className="btn sec sm" aria-pressed={mode === 'cancel'} onClick={() => setMode(mode === 'cancel' ? null : 'cancel')}>
          Cancel visit
        </button>
      </div>
      {mode === 'move' ? (
        <div className="flex flex-wrap items-center gap-2">
          <select className="fld" value={newDay} onChange={(e) => setNewDay(e.target.value)} aria-label="New day">
            {moveDays.every((d) => d.date !== day) ? <option value={day}>{day}</option> : null}
            {moveDays.map((d) => (
              <option key={d.date} value={d.date}>
                {d.label}
              </option>
            ))}
          </select>
          <select className="fld" value={newStart} onChange={(e) => setNewStart(e.target.value)} aria-label="New time">
            {starts.map((s) => (
              <option key={s.start} value={s.start}>
                {s.label}
              </option>
            ))}
          </select>
          <input className="fld min-w-[14rem] flex-1" maxLength={300} placeholder="Line for the client (optional)" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => moveVisitAction(id, newDay, newStart, text))}>
            Move visit
          </button>
        </div>
      ) : null}
      {mode === 'done' ? (
        <div className="flex flex-wrap items-center gap-2">
          <input className="fld min-w-[14rem] flex-1" maxLength={300} placeholder="What was done (optional, the client reads it)" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="button" className="btn pri sm" disabled={pending} onClick={() => run(() => finishVisitAction(id, text))}>
            Mark done
          </button>
        </div>
      ) : null}
      {mode === 'cancel' ? (
        <div className="flex flex-wrap items-center gap-2">
          <input className="fld min-w-[14rem] flex-1" maxLength={300} placeholder="Why (the client reads this)" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="button" className="btn pri sm" disabled={pending || text.trim().length < 5} onClick={() => run(() => cancelVisitAction(id, text))}>
            {paid ? `Cancel and refund ${charge}` : 'Cancel visit'}
          </button>
        </div>
      ) : null}
      {msg ? (
        <p role="status" className={`m-0 sm ${msg.ok ? 'good-t' : 'bad-t'}`}>
          {msg.message}
        </p>
      ) : null}
    </div>
  );
}
