'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { acceptSnagAction, addSnagsAction, disputeSnagAction } from './snag-actions';

/** One snag as the office inbox shows it (built in SnagsTab.tsx). */
export interface InboxSnag {
  id: string;
  title: string;
  room: string | null;
  raisedNote: string | null;
  raisedLine: string;
  state: 'raised' | 'accepted' | 'disputed' | 'fixed' | 'reopened' | 'closed';
  lane: 'needs-you' | 'being-fixed' | 'waiting-customer' | 'closed';
  fixByDay: string;
  fixByLabel: string | null;
  overdue: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  internalNote: string | null;
  disputeReason: string | null;
  notFixedReason: string | null;
  fixSentence: string | null;
  fixedLabel: string | null;
  autoClosesLabel: string | null;
  closedLabel: string | null;
  closedBy: 'customer' | 'auto' | null;
  before: string | null;
  after: string | null;
  reopenCount: number;
}

type Assignee = { id: string; name: string; role: string };

const ROLE: Record<string, string> = { OWNER: 'Owner', PM: 'Project manager', SUPERVISOR: 'Site supervisor' };
const muted = 'text-[12.5px] text-[var(--s-ink-3)]';
const lockIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export function SnagInbox(props: {
  projectId: string;
  customerFirst: string;
  canAccept: boolean;
  canFix: boolean;
  assignees: Assignee[];
  quickDays: { label: string; day: string }[];
  today: string;
  snags: InboxSnag[];
}) {
  const { snags, customerFirst, canAccept } = props;
  const [adding, setAdding] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const lanes = [
    { key: 'needs-you', title: 'Needs you', empty: 'Nothing waiting for an answer.' },
    { key: 'being-fixed', title: 'Being fixed', empty: null },
    { key: 'waiting-customer', title: `Waiting for ${customerFirst}`, empty: null },
  ] as const;
  const closed = snags.filter((s) => s.lane === 'closed');

  return (
    <div className="mt-4 flex flex-col gap-5">
      {canAccept ? (
        adding ? (
          <AddSnags projectId={props.projectId} customerFirst={customerFirst} onDone={() => setAdding(false)} />
        ) : (
          <div>
            <button type="button" className="s-btn-ghost" onClick={() => setAdding(true)}>
              Add snags · handover walk-through
            </button>
          </div>
        )
      ) : null}

      {snags.length === 0 ? <p className={`m-0 ${muted}`}>No snags on this project.</p> : null}

      {snags.length > 0
        ? lanes.map((lane) => {
            const list = snags.filter((s) => s.lane === lane.key);
            if (list.length === 0 && !lane.empty) return null;
            return (
              <section key={lane.key} aria-label={lane.title} className="flex flex-col gap-2">
                <h3 className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--s-ink-3)]">
                  {lane.title} <span className="font-[family-name:var(--font-mono)]">{list.length}</span>
                </h3>
                {list.length === 0 ? <p className={`m-0 ${muted}`}>{lane.empty}</p> : null}
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {list.map((s) => (
                    <SnagCard key={s.id} snag={s} {...props} />
                  ))}
                </ul>
              </section>
            );
          })
        : null}

      {closed.length ? (
        <section aria-label="Closed" className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowClosed((v) => !v)}
            aria-expanded={showClosed}
            className="self-start text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--s-ink-3)] hover:text-[var(--s-ink)]"
          >
            Closed <span className="font-[family-name:var(--font-mono)]">{closed.length}</span> {showClosed ? '▾' : '▸'}
          </button>
          {showClosed ? (
            <ul className="m-0 flex list-none flex-col p-0">
              {closed.map((s) => (
                <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-[var(--s-rule)] py-2.5 text-[13.5px]">
                  <span>
                    {s.title}
                    <span className={`block ${muted}`}>{[s.room, s.raisedLine].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="text-right text-[12.5px] text-[var(--s-good)]">
                    {s.closedBy === 'auto' ? 'Closed after 7 days' : `Closed · ${customerFirst} confirmed`}
                    {s.closedLabel ? <span className={`block ${muted}`}>{s.closedLabel}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function SnagCard({
  snag: s,
  projectId,
  customerFirst,
  canAccept,
  canFix,
  assignees,
  quickDays,
  today,
}: {
  snag: InboxSnag;
  projectId: string;
  customerFirst: string;
  canAccept: boolean;
  canFix: boolean;
  assignees: Assignee[];
  quickDays: { label: string; day: string }[];
  today: string;
}) {
  const [mode, setMode] = useState<'view' | 'accept' | 'dispute'>('view');
  const status = statusLine(s, customerFirst);
  return (
    <li className="rounded-[12px] border border-[var(--s-rule)] bg-[var(--s-surface)] p-3.5">
      <div className="flex gap-3">
        {s.before ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.before} alt="" className="h-16 w-16 flex-none rounded-[8px] object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-[14.5px] font-semibold">{s.title}</span>
            <span className="text-[12.5px] font-medium" style={{ color: status.tone }}>
              {status.text}
            </span>
          </div>
          <p className={`m-0 mt-0.5 ${muted}`}>{[s.room, s.raisedLine].filter(Boolean).join(' · ')}</p>
          {s.raisedNote ? <p className="m-0 mt-1.5 text-[13.5px] text-[var(--s-ink-2)]">“{s.raisedNote}”</p> : null}
          {s.state === 'reopened' ? (
            <p className="m-0 mt-1.5 text-[13.5px]" style={{ color: 'var(--s-bad)' }}>
              {customerFirst} says it is not fixed{s.notFixedReason ? `: “${s.notFixedReason}”` : '.'}
            </p>
          ) : null}
          {s.disputeReason ? <p className="m-0 mt-1.5 text-[13.5px] text-[var(--s-ink-2)]">Your reason, which {customerFirst} reads: “{s.disputeReason}”</p> : null}
          {s.internalNote && s.lane !== 'closed' ? (
            <p className="m-0 mt-1.5 inline-flex items-start gap-1.5 rounded-[6px] bg-[var(--s-surface-2)] px-2 py-1 text-[12.5px] text-[var(--s-ink-2)]">
              <span className="mt-[3px]">{lockIcon}</span>
              <span>
                Only your team: {s.internalNote}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {s.lane === 'waiting-customer' ? (
        <div className="mt-3 grid max-w-[420px] grid-cols-2 gap-2">
          <Photo src={s.before} caption="Before" />
          <Photo src={s.after} caption={`After · ${s.fixedLabel ?? ''}`} />
          {s.fixSentence ? <p className="col-span-2 m-0 text-[13.5px]">“{s.fixSentence}”</p> : null}
          <p className={`col-span-2 m-0 ${muted}`}>
            {customerFirst} confirms or says not fixed. {s.autoClosesLabel ? `Closes by itself on ${s.autoClosesLabel}.` : ''}
          </p>
        </div>
      ) : null}

      {mode === 'view' && s.lane !== 'waiting-customer' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canAccept && (s.state === 'raised' || s.state === 'reopened' || s.state === 'disputed') ? (
            <button type="button" className="s-btn" onClick={() => setMode('accept')}>
              Accept · set fix-by
            </button>
          ) : null}
          {canAccept && s.state === 'accepted' ? (
            <button type="button" className="s-btn-ghost" onClick={() => setMode('accept')}>
              Change date or person
            </button>
          ) : null}
          {canAccept && (s.state === 'raised' || s.state === 'reopened' || s.state === 'accepted') ? (
            <button type="button" className="s-btn-ghost" onClick={() => setMode('dispute')}>
              Not a defect…
            </button>
          ) : null}
          {canFix && s.state !== 'disputed' ? (
            <Link href={`/studio/site/snag/${s.id}`} className="s-btn-ghost no-underline">
              Mark fixed (after photo)
            </Link>
          ) : null}
        </div>
      ) : null}

      {mode === 'accept' ? (
        <AcceptForm snag={s} projectId={projectId} customerFirst={customerFirst} assignees={assignees} quickDays={quickDays} today={today} onClose={() => setMode('view')} />
      ) : null}
      {mode === 'dispute' ? <DisputeForm snag={s} projectId={projectId} customerFirst={customerFirst} onClose={() => setMode('view')} /> : null}
    </li>
  );
}

function statusLine(s: InboxSnag, customerFirst: string): { text: string; tone: string } {
  switch (s.state) {
    case 'raised':
      return { text: 'New · not answered yet', tone: 'var(--s-warn)' };
    case 'reopened':
      return { text: `Not fixed, says ${customerFirst}${s.reopenCount > 1 ? ` (${s.reopenCount}×)` : ''}`, tone: 'var(--s-bad)' };
    case 'accepted':
      return s.overdue
        ? { text: `Late · was due ${s.fixByLabel}${s.assigneeName ? ` · ${s.assigneeName}` : ''}`, tone: 'var(--s-bad)' }
        : { text: `Fix by ${s.fixByLabel ?? '—'}${s.assigneeName ? ` · ${s.assigneeName}` : ''}`, tone: 'var(--s-accent)' };
    case 'disputed':
      return { text: `Disputed · ${customerFirst} can agree, or our team looks at it`, tone: 'var(--s-ink-2)' };
    case 'fixed':
      return { text: `Fixed · waiting for ${customerFirst}`, tone: 'var(--s-good)' };
    case 'closed':
      return { text: 'Closed', tone: 'var(--s-good)' };
  }
}

function Photo({ src, caption }: { src: string | null; caption: string }) {
  return (
    <figure className="m-0 flex flex-col gap-1">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={caption} className="aspect-[4/3] w-full rounded-[8px] object-cover" />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[8px] bg-[var(--s-surface-2)] text-[12px] text-[var(--s-ink-3)]">No photo</div>
      )}
      <figcaption className="text-[12px] text-[var(--s-ink-3)]">{caption}</figcaption>
    </figure>
  );
}

function AcceptForm({
  snag,
  projectId,
  customerFirst,
  assignees,
  quickDays,
  today,
  onClose,
}: {
  snag: InboxSnag;
  projectId: string;
  customerFirst: string;
  assignees: Assignee[];
  quickDays: { label: string; day: string }[];
  today: string;
  onClose: () => void;
}) {
  const [day, setDay] = useState(snag.fixByDay || quickDays[1]?.day || today);
  const [who, setWho] = useState(snag.assigneeId ?? (assignees.length === 1 ? assignees[0]!.id : ''));
  const [note, setNote] = useState(snag.internalNote ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await acceptSnagAction(projectId, snag.id, { fixBy: day, assigneeId: who, internalNote: note });
      if (r.ok) onClose();
      else setError(r.error);
    });
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-[10px] bg-[var(--s-surface-2)] p-3">
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 text-[12.5px] font-semibold text-[var(--s-ink-2)]">
          Fix by <span className="font-normal text-[var(--s-accent)]">· {customerFirst} sees this</span>
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          {quickDays.map((q) => (
            <button
              key={q.day}
              type="button"
              aria-pressed={day === q.day}
              onClick={() => setDay(q.day)}
              className="min-h-[36px] rounded-full border px-3 text-[13px]"
              style={day === q.day ? { background: 'var(--s-accent)', borderColor: 'var(--s-accent)', color: '#fff' } : { borderColor: 'var(--s-rule)' }}
            >
              {q.label}
            </button>
          ))}
          <input type="date" aria-label="Fix-by date" className="s-input max-w-[170px]" min={today} value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
      </fieldset>
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 text-[12.5px] font-semibold text-[var(--s-ink-2)]">Who fixes it · only your team</legend>
        {assignees.length === 0 ? (
          <p className={`m-0 ${muted}`}>Nobody on this project yet. Add a supervisor to it from Settings, Team.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assignees.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={who === a.id}
                onClick={() => setWho(a.id)}
                className="min-h-[36px] rounded-full border px-3 text-left text-[13px]"
                style={who === a.id ? { background: 'var(--s-accent)', borderColor: 'var(--s-accent)', color: '#fff' } : { borderColor: 'var(--s-rule)' }}
              >
                {a.name} <span className="opacity-75">· {ROLE[a.role] ?? a.role}</span>
              </button>
            ))}
          </div>
        )}
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--s-ink-2)]">
          {lockIcon} Note for them · only your team (optional)
        </span>
        <input className="s-input" maxLength={300} value={note} placeholder="Add a 3-inch filler strip, laminate to match the shutters." onChange={(e) => setNote(e.target.value)} />
      </label>
      {error ? (
        <p role="alert" className="m-0 text-[13px] text-[var(--s-bad)]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="s-btn" disabled={pending || !day || !who} onClick={save}>
          {pending ? 'Saving…' : `Accept · tell ${customerFirst}`}
        </button>
        <button type="button" className="s-btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
      {!who && assignees.length ? <p className={`m-0 ${muted}`}>Pick who fixes it.</p> : null}
    </div>
  );
}

function DisputeForm({ snag, projectId, customerFirst, onClose }: { snag: InboxSnag; projectId: string; customerFirst: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      const r = await disputeSnagAction(projectId, snag.id, reason);
      if (r.ok) onClose();
      else setError(r.error);
    });
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-[10px] bg-[var(--s-surface-2)] p-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-[var(--s-ink-2)]">
          Why it is not a defect <span className="font-normal text-[var(--s-accent)]">· {customerFirst} reads this</span>
        </span>
        <textarea
          className="s-input min-h-[72px]"
          maxLength={300}
          value={reason}
          placeholder="Natural stone has veins like this; it was in the sample you picked on 12 Sep."
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <p className={`m-0 ${muted}`}>The snag stays open. {customerFirst} can agree and close it; if not, our team looks at it with you.</p>
      {error ? (
        <p role="alert" className="m-0 text-[13px] text-[var(--s-bad)]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="s-btn" disabled={pending || reason.trim().length < 3} onClick={send}>
          {pending ? 'Sending…' : `Send to ${customerFirst}`}
        </button>
        <button type="button" className="s-btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddSnags({ projectId, customerFirst, onDone }: { projectId: string; customerFirst: string; onDone: () => void }) {
  const blank = () => ({ key: Math.random().toString(36).slice(2), title: '', room: '' });
  const [rows, setRows] = useState(() => [blank(), blank(), blank()]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const filled = rows.filter((r) => r.title.trim()).length;
  const set = (key: string, patch: Partial<{ title: string; room: string }>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const save = () =>
    start(async () => {
      const r = await addSnagsAction(
        projectId,
        rows.filter((x) => x.title.trim() || x.room.trim()).map(({ title, room }) => ({ title, room })),
      );
      if (r.ok) {
        setRows([blank(), blank(), blank()]);
        setMessage({ ok: true, text: r.message ?? 'Added.' });
      } else setMessage({ ok: false, text: r.error });
    });
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--s-rule)] bg-[var(--s-surface-2)] p-3.5">
      <p className="m-0 text-[14px] font-semibold">Handover walk-through</p>
      <p className={`m-0 ${muted}`}>
        Walk the flat with {customerFirst} and add everything here, one line each. {customerFirst} sees the list in the app. Accept each one after, with a date and who fixes it.
      </p>
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_150px] gap-2">
            <input
              className="s-input"
              aria-label={`Snag ${i + 1}: what is wrong`}
              placeholder={i === 0 ? 'Shutter rubbing at the top' : 'What is wrong'}
              maxLength={120}
              value={r.title}
              onChange={(e) => set(r.key, { title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && i === rows.length - 1 && r.title.trim()) setRows((rs) => [...rs, blank()]);
              }}
            />
            <input className="s-input" aria-label={`Snag ${i + 1}: room`} placeholder="Room" maxLength={40} value={r.room} onChange={(e) => set(r.key, { room: e.target.value })} />
          </div>
        ))}
      </div>
      <button type="button" className="self-start text-[13px] text-[var(--s-accent)]" onClick={() => setRows((rs) => [...rs, blank()])}>
        + Another line
      </button>
      {message ? (
        <p role="status" className={`m-0 text-[13px] ${message.ok ? 'text-[var(--s-good)]' : 'text-[var(--s-bad)]'}`}>
          {message.text}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="s-btn" disabled={pending || filled === 0} onClick={save}>
          {pending ? 'Adding…' : filled > 0 ? `Add ${filled} snag${filled === 1 ? '' : 's'}` : 'Add snags'}
        </button>
        <button type="button" className="s-btn-ghost" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
