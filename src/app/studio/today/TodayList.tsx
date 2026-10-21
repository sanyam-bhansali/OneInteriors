'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TodayRow, TodaySection } from '@/modules/studio-sales/today-rules';
import { assignLeadsAction } from '../sales-actions';
import { setTaskDoneAction } from '../tasks-actions';
import { bulkClaimAction } from '../clients/list-actions';
import type { Done } from '../sales-types';
import { RowCall, type CallSheetStage } from '../clients/CallLogger';
import { Said, useAct } from '../SalesUi';
import '../office-ui.css';
import './today.css';

/**
 * The Today list, in the owner's handoff (StudioHome, "Your list for
 * today"): one card, a ring that fills as lines are ticked, and "Day
 * cleared" when every line is. Sections with nothing in them are left out;
 * each section keeps its head, its "and N more", and (the pool) its
 * assign-all. One button per row, as before.
 *
 * Ticking: a task's tick marks the task done on the server (the same action
 * the Done button used). Every other line is a reminder built from the
 * leads, so its tick is this person's own note that it is handled — kept in
 * this browser for the day, never sent anywhere — and the line stays until
 * the underlying lead moves on.
 *
 * A call due (and, for owner and PM, a lead nobody has called) has Call and
 * Log call on its line (calling steps, owner 21 Oct 2026): the lead page's
 * sheet; logging it ticks the line and the list refreshes in place.
 */

const dayKey = () => `oi-today-ticks:${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}`;

const CONFETTI = ['var(--acc)', 'var(--good-s)', 'var(--warn-s)', 'var(--muted2)'];

export function TodayList({ sections, members, meId, stages = [] }: { sections: TodaySection[]; members: { id: string; name: string }[]; meId: string; stages?: CallSheetStage[] }) {
  const filled = sections.filter((s) => s.rows.length > 0);
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(dayKey()) ?? '[]');
      if (Array.isArray(saved)) setTicked(new Set(saved.filter((x): x is string => typeof x === 'string')));
    } catch {
      /* private mode: ticks last for this visit only */
    }
  }, []);

  const flip = (key: string, on: boolean) =>
    setTicked((t) => {
      const n = new Set(t);
      if (on) n.add(key);
      else n.delete(key);
      try {
        localStorage.setItem(dayKey(), JSON.stringify([...n]));
      } catch {
        /* private mode */
      }
      return n;
    });

  const all = filled.flatMap((s) => s.rows);
  const total = all.length;
  const done = all.filter((r) => ticked.has(r.key)).length;
  const cleared = total > 0 && done === total;
  const off = Math.round(119.4 * (1 - (total ? done / total : 0)) * 10) / 10;

  return (
    <section className="card" aria-labelledby="h-list" style={{ gap: 4 }}>
      <div className="chead" style={{ paddingBottom: 8 }}>
        <div className="hstack" style={{ gap: 12 }}>
          <span className="oi-ring" role="img" aria-label={`${done} of ${total} done today`}>
            <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
              <circle cx="23" cy="23" r="19" fill="none" strokeWidth="5" style={{ stroke: 'var(--fill)' }} />
              <circle
                className="ringarc"
                cx="23"
                cy="23"
                r="19"
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="119.4"
                strokeDashoffset={off}
                transform="rotate(-90 23 23)"
                style={{ stroke: cleared ? 'var(--good-s)' : 'var(--acc)' }}
              />
            </svg>
            <b style={{ fontSize: `${done}/${total}`.length > 5 ? 9 : `${done}/${total}`.length > 4 ? 10.5 : undefined }}>
              {done}/{total}
            </b>
          </span>
          <h2 id="h-list">Your list for today</h2>
        </div>
      </div>
      {cleared ? (
        <div className="cheer" role="status">
          {Array.from({ length: 12 }, (_, i) => (
            <i
              key={i}
              aria-hidden="true"
              style={
                {
                  left: `${5 + i * 8}%`,
                  background: CONFETTI[i % 4],
                  '--dx': `${(i % 2 ? -1 : 1) * (10 + i * 3)}px`,
                  '--rot': `${180 + i * 40}deg`,
                  animationDelay: `${(i * 0.07).toFixed(2)}s`,
                } as React.CSSProperties
              }
            />
          ))}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 5 5 9-10" />
          </svg>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <b>Day cleared</b>
            <span className="sm">Everything on today&apos;s list is done. Nice work.</span>
          </span>
        </div>
      ) : null}
      <div className="td-list">
        {filled.map((s) => (
          <div key={s.id} role="group" aria-labelledby={`today-${s.id}`}>
            <div className="td-sec">
              <h3 id={`today-${s.id}`}>{s.title}</h3>
              <span className="mono muted sm">{s.rows.length + s.more}</span>
            </div>
            {s.id === 'pool' && members.length > 0 ? <AssignAll ids={s.rows.map((r) => r.leadId!).filter(Boolean)} members={members} /> : null}
            {s.rows.map((r) => (
              <Row key={r.key} row={r} kind={s.title} members={members} meId={meId} on={ticked.has(r.key)} flip={flip} stages={stages} />
            ))}
            {s.more > 0 ? (
              <p className="td-more">
                And {s.more} more.{' '}
                <Link href={s.seeAll ?? '/studio/clients'} className="ox-link">
                  See them all
                </Link>
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <p className="muted sm" style={{ margin: '10px 4px 0' }}>
        The list builds itself from your leads, quotes, tasks and meetings. Tick a line when it&apos;s handled.
      </p>
    </section>
  );
}

function Row({ row, kind, members, meId, on, flip, stages }: { row: TodayRow; kind: string; members: { id: string; name: string }[]; meId: string; on: boolean; flip: (key: string, on: boolean) => void; stages: CallSheetStage[] }) {
  const task = row.action.kind === 'task' && row.action.taskId ? row.action.taskId : null;
  const { pending, result, run } = useAct();
  const tick = () => {
    if (task) {
      if (on) return;
      run(
        () => setTaskDoneAction(task, true, row.leadId),
        (r) => {
          if (r.ok) flip(row.key, true);
        },
      );
    } else flip(row.key, !on);
  };
  return (
    <div className={`task${on ? ' done' : ''}`}>
      <button type="button" className="tick" role="checkbox" aria-checked={on} aria-label={`${on ? 'Mark not done' : 'Mark done'}: ${row.title}`} disabled={pending || (task !== null && on)} onClick={tick}>
        {on ? '✓' : ''}
      </button>
      <div className="tbody">
        <span className="kind">{kind}</span>
        {row.leadId ? (
          <Link href={`/studio/clients/${row.leadId}`} className="ttl">
            {row.title}
          </Link>
        ) : (
          <span className="ttl">{row.title}</span>
        )}
        <span className={`tctx${row.late ? ' late' : ''}`}>{row.detail}</span>
        <Said result={result} />
      </div>
      <div className="td-act">
        {row.action.kind === 'assign' && row.leadId ? (
          <AssignOne leadId={row.leadId} members={members} meId={meId} />
        ) : task ? (
          row.leadId ? (
            <Link href={`/studio/clients/${row.leadId}`} className="btn ghost sm">
              Open
            </Link>
          ) : null
        ) : row.call && stages.length > 0 ? (
          <RowCall lead={{ id: row.call.leadId, name: row.call.name, phone: row.call.phone, stageId: row.call.stageId }} stages={stages} onLogged={() => flip(row.key, true)} />
        ) : row.action.kind === 'claim' && row.action.leadId ? (
          <ActOnce label="Claim" busy="Claiming…" act={() => bulkClaimAction({ ids: [row.action.leadId!] })} />
        ) : (
          <Link href={row.action.href} className={row.action.kind === 'call' ? 'btn pri sm' : 'btn ghost sm'}>
            {row.action.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function AssignOne({ leadId, members, meId }: { leadId: string; members: { id: string; name: string }[]; meId: string }) {
  const [to, setTo] = useState('');
  const { pending, result, run } = useAct();
  return (
    <div className="td-act">
      <div className="hstack" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <select aria-label="Give this lead to" value={to} onChange={(e) => setTo(e.target.value)} className="fld sm fit">
          <option value="">Give to…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === meId ? `${m.name} (me)` : m.name}
            </option>
          ))}
        </select>
        <button type="button" disabled={pending || !to} onClick={() => run(() => assignLeadsAction([leadId], to))} className="btn pri sm">
          {pending ? 'Assigning…' : 'Assign'}
        </button>
      </div>
      <Said result={result} />
    </div>
  );
}

/** Every lead in the pool to one person, in one go (asks first). */
function AssignAll({ ids, members }: { ids: string[]; members: { id: string; name: string }[] }) {
  const [to, setTo] = useState('');
  const [sure, setSure] = useState(false);
  const { pending, result, run } = useAct();
  if (ids.length < 2) return null;
  return (
    <div className="td-assign">
      <span className="muted">Give all {ids.length} shown to</span>
      <select
        aria-label="Give all these leads to"
        value={to}
        onChange={(e) => {
          setTo(e.target.value);
          setSure(false);
        }}
        className="fld sm fit"
      >
        <option value="">pick a person…</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {to ? (
        sure ? (
          <button type="button" disabled={pending} onClick={() => run(() => assignLeadsAction(ids, to), () => setSure(false))} className="btn pri sm">
            {pending ? 'Assigning…' : `Yes, give all ${ids.length}`}
          </button>
        ) : (
          <button type="button" onClick={() => setSure(true)} className="btn ghost sm">
            Assign all
          </button>
        )
      ) : null}
      <Said result={result} />
    </div>
  );
}

/** One button that does one thing (claim a pool lead). */
function ActOnce({ label, busy, act }: { label: string; busy: string; act: () => Promise<Done> }) {
  const { pending, result, run } = useAct();
  return (
    <div className="td-act">
      <button type="button" disabled={pending} onClick={() => run(act)} className="btn pri sm">
        {pending ? busy : label}
      </button>
      <Said result={result} />
    </div>
  );
}
