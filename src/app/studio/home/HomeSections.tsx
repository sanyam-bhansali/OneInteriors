'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { TodayRow } from '@/modules/studio-sales/today-rules';
import { logContactAction } from '../clients/actions';
import { setTaskDoneAction } from '../tasks-actions';

/**
 * The lower half of the role homes (StudioSalesHome, StudioDesHome,
 * StudioPMHome in the owner's UI handoff). Everything here is drawn from
 * rows the server already scoped to this person (`myToday`, `mySitesToday`,
 * `designWorkload`); the buttons call the same server actions the lead page
 * and the Today list use.
 */

/* ── The progress ring (.oi-ring) ───────────────────────────── */

export function Ring({ done, total, label }: { done: number; total: number; label: string }) {
  const off = Math.round(119.4 * (1 - (total ? done / total : 0)) * 10) / 10;
  return (
    <span className="oi-ring" role="img" aria-label={label}>
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
          style={{ stroke: total > 0 && done === total ? 'var(--good-s)' : 'var(--acc)' }}
        />
      </svg>
      <b>
        {done}/{total}
      </b>
    </span>
  );
}

const CONFETTI = ['var(--acc)', 'var(--good-s)', 'var(--warn-s)', 'var(--muted2)'];

function DayCleared() {
  return (
    <div className="cheer" role="status">
      {Array.from({ length: 12 }, (_, i) => (
        <i
          key={i}
          style={{ left: `${5 + i * 8}%`, background: CONFETTI[i % 4], ['--dx' as string]: `${(i % 2 ? -1 : 1) * (10 + i * 3)}px`, ['--rot' as string]: `${180 + i * 40}deg`, animationDelay: `${i * 0.07}s` }}
        />
      ))}
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <b>Day cleared</b>
        <span className="sm">Everything on today&rsquo;s list is done. Nice work.</span>
      </span>
    </div>
  );
}

/* ── Sales: the next call, and today's calls ────────────────── */

const phoneOf = (row: TodayRow): string | null => (row.action.kind === 'call' && row.action.href.startsWith('tel:') ? row.action.href.slice(4) : null);
const shownPhone = (p: string) => p.replace(/^\+91(\d{5})(\d{5})$/, '$1 $2');

/** One tap after the call: each logs a real call outcome on the lead (the lead page's own action) and sets its next follow-up. */
const AFTER_CALL: { label: string; outcome: string; note?: string; open?: boolean }[] = [
  { label: 'Interested, book a meeting', outcome: 'spoke', open: true },
  { label: 'Call back later', outcome: 'busy' },
  { label: "Didn't pick up", outcome: 'no_answer' },
  { label: 'Busy', outcome: 'line_busy' },
  { label: 'Switched off', outcome: 'switched_off' },
  { label: 'Wants a quote', outcome: 'spoke', note: 'Wants a quotation', open: true },
  { label: 'Not interested', outcome: 'not_interested' },
];

export function SalesCalls({ calls, more }: { calls: TodayRow[]; more: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  /* The design's queue: the first five due; the rest are one tap away on Leads. */
  const shown = calls.slice(0, 5);
  const left = calls.filter((c) => !done.includes(c.key));
  const next = left[0] ?? null;
  const total = calls.length + more;
  const doneN = done.length;
  const phone = next ? phoneOf(next) : null;

  const log = (row: TodayRow, o: (typeof AFTER_CALL)[number]) => {
    if (!row.leadId) return;
    setError(null);
    start(async () => {
      const r = await logContactAction(row.leadId!, o.outcome, o.note ?? null, null);
      if ('error' in r) {
        setError(r.error);
        return;
      }
      setDone((d) => [...d, row.key]);
      if (o.open) router.push(`/studio/clients/${row.leadId}`);
      else router.refresh();
    });
  };

  return (
    <div className="sgrid">
      {next ? (
        <section className="hero" aria-labelledby="h-next">
          <div className="hstack" style={{ justifyContent: 'space-between' }}>
            <span className="sm" style={{ color: 'var(--inv-acc)', fontWeight: 600 }}>
              Next call · {doneN + 1} of {total}
            </span>
            {next.late ? <span className="chip warn">Late</span> : <span className="chip">Due today</span>}
          </div>
          <div>
            <h2 id="h-next" style={{ margin: 0, fontSize: 26, fontWeight: 500, letterSpacing: '-.03em' }}>
              {next.leadId ? (
                <Link href={`/studio/clients/${next.leadId}`} style={{ color: 'inherit' }}>
                  {next.title}
                </Link>
              ) : (
                next.title
              )}
            </h2>
            {phone ? <span className="muted mono">{shownPhone(phone)}</span> : null}
          </div>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45 }}>{next.detail}</p>
          <div className="hstack">
            {phone ? (
              <>
                <a href={`tel:${phone}`} className="btn acc lg">
                  <PhoneIcon />
                  Call now
                </a>
                <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn lg inv">
                  <ChatIcon />
                  WhatsApp
                </a>
              </>
            ) : next.leadId ? (
              <Link href={`/studio/clients/${next.leadId}`} className="btn acc lg">
                Open the lead
              </Link>
            ) : null}
          </div>
          {next.leadId ? (
            <div className="after">
              <span className="sm" style={{ fontWeight: 600 }}>
                After the call, one tap. The next lead comes up.
              </span>
              <div className="out">
                {AFTER_CALL.map((o) => (
                  <button key={o.label} type="button" disabled={pending} onClick={() => log(next, o)}>
                    {o.label}
                  </button>
                ))}
              </div>
              {error ? (
                <span role="alert" className="sm" style={{ color: 'var(--inv-bad)' }}>
                  {error}
                </span>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="hero">
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 500 }}>
            {total > 0 ? "All of today's calls are done." : 'No calls due today.'}
          </h2>
          <span className="muted">Follow-up dates are saved. New calls show here the day they are due.</span>
          <Link href="/studio/clients" className="btn acc" style={{ alignSelf: 'flex-start' }}>
            Open your leads
          </Link>
        </section>
      )}

      <section className="card" aria-labelledby="h-q" style={{ gap: 6 }}>
        <div className="chead" style={{ paddingBottom: 6 }}>
          <div className="hstack" style={{ gap: 12 }}>
            <Ring done={Math.min(doneN, shown.length)} total={shown.length} label={`${doneN} of ${total} calls done`} />
            <h2 id="h-q">Today&rsquo;s calls</h2>
          </div>
          <span className="muted sm">
            <b className="mono" style={{ color: 'var(--ink)' }}>
              {doneN}
            </b>{' '}
            of <span className="mono">{total}</span> done
          </span>
        </div>
        {total > 0 && doneN === total ? <DayCleared /> : null}
        {calls.length === 0 ? <p className="muted sm" style={{ margin: 0 }}>Nothing to call today.</p> : null}
        {shown.map((c) => {
          const isDone = done.includes(c.key);
          const now = next?.key === c.key;
          return (
            <div key={c.key} className="qrow" style={{ opacity: isDone ? 0.6 : 1 }}>
              <span className="mono sm" style={{ color: c.late ? 'var(--bad)' : 'var(--acc)', fontWeight: 600 }}>
                {c.late ? 'late' : 'today'}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                {c.leadId ? (
                  <Link href={`/studio/clients/${c.leadId}`} style={{ fontWeight: 600, textDecoration: isDone ? 'line-through' : undefined }}>
                    {c.title}
                  </Link>
                ) : (
                  <b style={{ fontWeight: 600 }}>{c.title}</b>
                )}
                <span className="muted sm">{c.detail}</span>
              </div>
              <span className={`chip ${isDone ? 'good' : now ? 'oi' : ''}`}>{isDone ? 'Done' : now ? 'Calling now' : 'To call'}</span>
            </div>
          );
        })}
        {total - shown.length > 0 ? (
          <Link href="/studio/clients?view=list&due=due&sort=followup" className="sm acc-t" style={{ fontWeight: 600, paddingTop: 8 }}>
            and {total - shown.length} more
          </Link>
        ) : null}
      </section>
    </div>
  );
}

/* ── "Your list": the ring, ticks and one button per row ───── */

export interface ListRow {
  key: string;
  title: string;
  ctx: string;
  href: string;
  action: string;
  /** A real task: its tick marks it done on the server. */
  taskId?: string;
  leadId?: string | null;
}

const dayKey = () => `oi-today-ticks:${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}`;

/**
 * Ticking a task marks it done on the server (the Today list's own action).
 * Any other line is a reminder built from the leads or the plan, so its tick
 * is this person's own note that it is handled, kept in this browser for the
 * day (the same key as the Today list) and never sent anywhere.
 */
export function YourList({ rows, more, moreHref, title = 'Your list' }: { rows: ListRow[]; more: number; moreHref: string; title?: string }) {
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(dayKey()) ?? '[]');
      if (Array.isArray(saved)) setTicked(new Set(saved.filter((x): x is string => typeof x === 'string')));
    } catch {
      /* private mode: ticks last for this visit */
    }
  }, []);
  const flip = (row: ListRow, on: boolean) => {
    setTicked((t) => {
      const n = new Set(t);
      if (on) n.add(row.key);
      else n.delete(row.key);
      try {
        localStorage.setItem(dayKey(), JSON.stringify([...n]));
      } catch {
        /* private mode */
      }
      return n;
    });
    if (row.taskId) start(async () => void (await setTaskDoneAction(row.taskId!, on, row.leadId ?? null)));
  };
  const total = rows.length;
  const done = rows.filter((r) => ticked.has(r.key)).length;
  return (
    <section className="card" aria-labelledby="h-list" style={{ gap: 4 }}>
      <div className="chead" style={{ paddingBottom: 8 }}>
        <div className="hstack" style={{ gap: 12 }}>
          <Ring done={done} total={total} label={`${done} of ${total} done today`} />
          <h2 id="h-list">{title}</h2>
        </div>
        <span className="muted sm">
          <b className="mono" style={{ color: 'var(--ink)' }}>
            {total - done + more}
          </b>{' '}
          left
        </span>
      </div>
      {total > 0 && done === total ? <DayCleared /> : null}
      {total === 0 ? <p className="muted sm" style={{ margin: '4px 0 0' }}>Nothing waiting on you today.</p> : null}
      {rows.map((r) => {
        const on = ticked.has(r.key);
        return (
          <div key={r.key} className={`drow${on ? ' done' : ''}`} style={{ opacity: on ? 0.6 : 1 }}>
            <button
              type="button"
              className="tick"
              role="checkbox"
              aria-checked={on}
              aria-label={`Done: ${r.title}`}
              onClick={() => flip(r, !on)}
              style={on ? { background: 'var(--good-s)', color: 'var(--paper)' } : { background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--line2)' }}
            >
              {on ? '✓' : ''}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, textDecoration: on ? 'line-through' : undefined }}>{r.title}</span>
              <span className="muted sm">{r.ctx}</span>
            </div>
            <Link href={r.href} className="btn ghost sm">
              {r.action}
            </Link>
          </div>
        );
      })}
      {more > 0 ? (
        <Link href={moreHref} className="sm acc-t" style={{ fontWeight: 600, paddingTop: 8 }}>
          and {more} more
        </Link>
      ) : null}
    </section>
  );
}

const PhoneIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
);

const ChatIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z" />
  </svg>
);
