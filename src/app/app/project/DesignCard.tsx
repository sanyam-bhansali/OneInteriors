'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { MyProject } from '@/components/app/useMyProject';
import { formatINR } from '@/lib/money';
import { shortDate } from '@/modules/app/project-view';

/**
 * The design phase on the website (Studio OS Phase 2,
 * docs/studio-os/PHASE-2-DESIGN.md §7): how far the design is, its
 * milestones (the steps the studio starred, docs/studio-os/CUSTOMER-MILESTONES.md),
 * what waits on you (a payment, your own step), the site visit, the mood board to fill, the
 * drawings to approve or ask changes on, and — once the design is closed —
 * what changed against the first quotation. The phone app shows the same,
 * from the same projection.
 */

type Design = NonNullable<MyProject['design']>;

const MONO = { margin: '4px 0 0', font: '400 13px var(--mono)', color: 'var(--ink-2)' } as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export function DesignCard({ design, studio, owner, docs, onChanged }: { design: Design; studio: string; owner: boolean; docs: MyProject['documents']; onChanged: () => void }) {
  const urlOf = (id: string) => docs.find((d) => d.id === id)?.url ?? '';
  const next = design.next;
  const booked = design.visits.filter((v) => v.status === 'booked');
  return (
    <section aria-label="Your design" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="oa-section-head">
        <h2>Your design</h2>
        <span className="oa-meta">{design.designer ? `with ${design.designer}` : studio}</span>
      </div>
      {design.pct !== null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="oa-meta">{design.done ? 'Design done' : 'Design so far'}</span>
            <b style={{ font: '600 22px var(--mono)' }}>{design.pct}%</b>
          </div>
          <span role="progressbar" aria-label={`Design ${design.pct}% done`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={design.pct} style={{ display: 'block', height: 8, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${design.pct}%`, borderRadius: 99, background: 'var(--accent)' }} />
          </span>
          {/* Days the design waited on them (owner, 27 Oct 2026); never the studio's own delays, never a date. */}
          {design.clientDelayDays > 0 && !design.done ? (
            <span className="oa-meta">
              Waited on you so far: {design.clientDelayDays} day{design.clientDelayDays === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      ) : null}

      {next && !design.done ? (
        <div className="oa-card" style={{ padding: 14 }}>
          <span className="oa-meta">Next</span>
          <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
            {next.label}
            {next.yours ? ' (your step)' : ''}
          </p>
          <p style={MONO}>
            {next.plannedOn ? `Planned ${shortDate(next.plannedOn)}` : ''}
            {next.waitingFor ? ` · opens when your ${next.waitingFor} is paid` : ''}
          </p>
          {next.moved ? <p style={MONO}>{next.moved}</p> : null}
        </div>
      ) : null}

      {!next && design.waitingFor && !design.done ? (
        <div className="oa-card" style={{ padding: 14 }}>
          <span className="oa-meta">Next</span>
          <p style={{ margin: '4px 0 0', fontWeight: 600 }}>The design goes on when your {design.waitingFor} is paid</p>
        </div>
      ) : null}

      {design.yourStep && !design.done ? (
        <div className="oa-flag">
          <span className="oa-meta" style={{ color: 'var(--accent-ink)' }}>
            Waiting on you
          </span>
          <p style={{ margin: '6px 0 0' }}>{design.yourStep}</p>
        </div>
      ) : null}

      {booked.map((v) => (
        <VisitCard key={v.id} visit={v} owner={owner} onChanged={onChanged} />
      ))}

      {design.requirementForm ? (
        <Link href="/app/requirements" className="oa-row" style={{ textDecoration: 'none' }} data-testid="requirements-row">
          <span>
            <span className="oa-row-title">{design.requirementForm === 'filled' ? 'Your requirement form' : 'Fill in your requirement form'}</span>
            <span className="oa-row-sub">
              {design.requirementForm === 'filled' ? 'Sent. Read what you told your designer.' : 'What your designer needs before the design starts: appliances, finishes, budget. About 10 minutes.'}
            </span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      ) : null}

      {design.moodBoard.shared ? (
        <Link href="/app/project/moodboard" className="oa-row" style={{ textDecoration: 'none' }}>
          <span>
            <span className="oa-row-title">Fill your mood board</span>
            <span className="oa-row-sub">{design.moodBoard.note ?? 'Pick what you like for each room. Your designer sees it.'}</span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      ) : null}

      {design.drawings.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="oa-meta">Drawings</span>
          {design.drawings.map((d) => (
            <Drawing key={d.id} d={d} url={urlOf(d.id)} owner={owner} onChanged={onChanged} />
          ))}
        </div>
      ) : null}

      {design.measurements.length ? (
        <details>
          <summary className="oa-meta" style={{ cursor: 'pointer', color: 'var(--accent-ink)' }}>
            Your rooms, as measured
          </summary>
          <ul className="oa-items" style={{ marginTop: 6 }}>
            {design.measurements.map((m) => (
              <li key={m.room} className="next">
                <span>{m.room}</span>
                <span>
                  {m.size}
                  {m.height ? `, ${m.height} high` : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {design.steps.length ? (
      <div>
        <span className="oa-meta">Milestones</span>
        <ul className="oa-items" style={{ marginTop: 6 }}>
          {design.steps.map((s, i) => (
            <li key={`${s.label}-${i}`} className={s.done ? 'done' : 'next'}>
              <span>
                {s.done ? '✓ ' : ''}
                {s.label}
              </span>
              <span>{s.done && s.doneOn ? `Done ${shortDate(s.doneOn)}` : s.waitingFor ? `After the ${s.waitingFor}` : s.plannedOn ? `Planned ${shortDate(s.plannedOn)}` : ''}</span>
            </li>
          ))}
        </ul>
      </div>
      ) : null}

      {design.changes ? (
        <div className="oa-card oa-changes">
          <p className="oa-label" style={{ marginTop: 0 }}>
            Your final design vs your first quotation
          </p>
          <b className="big">
            {formatINR(design.changes.salesTotalPaise)} → {formatINR(design.changes.designTotalPaise)}
          </b>
          <ul>
            {design.changes.lines.map((l, i) => (
              <li key={`${l.room}-${l.product}-${i}`}>
                <span>
                  {l.product}
                  <small>
                    {l.room} · {l.kind === 'ADDED' ? 'added' : l.kind === 'REMOVED' ? 'removed' : 'price changed'}
                  </small>
                </span>
                <span className="amt">{l.kind === 'REMOVED' ? `−${formatINR(l.wasPaise)}` : l.kind === 'ADDED' ? `+${formatINR(l.nowPaise)}` : formatINR(l.nowPaise)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Drawing({ d, url, owner, onChanged }: { d: Design['drawings'][number]; url: string; owner: boolean; onChanged: () => void }) {
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (verdict: 'APPROVED' | 'CHANGES') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/v1/design/${encodeURIComponent(d.id)}/answer`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict, comment: verdict === 'CHANGES' || catalogue ? comment : '' }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) setError(body?.error ?? 'That did not go through. Try again.');
      else {
        setAsking(false);
        onChanged();
      }
    } catch {
      setError('That did not go through. Try again.');
    } finally {
      setBusy(false);
    }
  };
  /* A catalogue is answered with the codes picked, not approved (walkthrough, 27 Oct 2026). */
  const catalogue = d.kind === 'CATALOGUE';
  const state = d.state === 'approved' ? (catalogue ? 'Your pick is sent' : 'Approved') : d.state === 'changes' ? 'Changes asked' : d.state === 'waiting' ? (catalogue ? 'Open it and pick' : 'Waiting for your answer') : 'Shared';
  return (
    <div className="oa-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--ink)' }}>
            {d.title}
          </a>
        ) : (
          <span style={{ fontWeight: 600 }}>{d.title}</span>
        )}
        <span className="oa-meta">{d.version > 1 || d.state === 'approved' ? `${d.kindLabel} · v${d.versionLabel ?? d.version}` : d.kindLabel}</span>
      </div>
      <span className="oa-meta" style={{ color: d.state === 'waiting' ? 'var(--accent-ink)' : undefined }}>
        {state}
        {d.comment ? ` · “${d.comment}”` : ''}
      </span>
      {owner && d.state === 'waiting' && catalogue ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="oa-meta" htmlFor={`c-${d.id}`}>
            The codes or names you picked
          </label>
          <textarea id={`c-${d.id}`} value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={1000} style={{ width: '100%', font: 'inherit', padding: 8, borderRadius: 8, border: '1px solid var(--line)' }} />
          <button type="button" className="oa-cta" disabled={busy || comment.trim().length < 2} onClick={() => void send('APPROVED')} style={{ alignSelf: 'flex-start' }}>
            Send my pick
          </button>
        </div>
      ) : null}
      {owner && d.state === 'waiting' && !asking && !catalogue ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="oa-cta" disabled={busy} onClick={() => void send('APPROVED')}>
            Approve
          </button>
          <button type="button" className="oa-inline-link" disabled={busy} onClick={() => setAsking(true)}>
            Ask for changes
          </button>
        </div>
      ) : null}
      {asking ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="oa-meta" htmlFor={`c-${d.id}`}>
            What would you like changed?
          </label>
          <textarea id={`c-${d.id}`} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000} style={{ width: '100%', font: 'inherit', padding: 8, borderRadius: 8, border: '1px solid var(--line)' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="oa-cta" disabled={busy || comment.trim().length < 3} onClick={() => void send('CHANGES')}>
              Send to your designer
            </button>
            <button type="button" className="oa-inline-link" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <span role="alert" className="oa-meta" style={{ color: 'var(--accent-ink)' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A booked site visit (owner, 1 Nov 2026; customer app Phase 2): the client
 * says they will be there, or asks for another day with why. Their designer
 * hears it at once.
 */
function VisitCard({ visit, owner, onChanged }: { visit: Design['visits'][number]; owner: boolean; onChanged: () => void }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function answer(a: 'confirm' | 'move') {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/app/v1/visits/${encodeURIComponent(visit.id)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer: a, reason }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { message?: string; error?: string } | null;
    setBusy(false);
    if (!res?.ok) return setMsg(body?.error ?? 'That did not go through. Try again.');
    setAsking(false);
    setMsg(body?.message ?? null);
    onChanged();
  }

  return (
    <div className="oa-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="oa-meta">{/meeting/i.test(visit.purpose) ? 'Meeting' : 'Site visit'}</span>
      <b>{visit.purpose}</b>
      <span className="oa-row-sub">{when(visit.at)}</span>
      {visit.answer === 'confirmed' ? <span className="oa-meta" style={{ color: 'var(--ok)' }}>You said you will be there.</span> : null}
      {visit.answer === 'move' ? <span className="oa-meta">You asked for another day{visit.reason ? `: ${visit.reason}` : ''}. Your designer will suggest one.</span> : null}
      {owner && !asking ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {visit.answer !== 'confirmed' ? (
            <button type="button" className="oa-cta" style={{ width: 'auto', paddingInline: 18 }} disabled={busy} onClick={() => void answer('confirm')}>
              I&rsquo;ll be there
            </button>
          ) : null}
          <button type="button" className="oa-cta outline" style={{ width: 'auto', paddingInline: 18 }} disabled={busy} onClick={() => setAsking(true)}>
            Ask for another day
          </button>
        </div>
      ) : null}
      {asking ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="oa-label" htmlFor={`why-${visit.id}`}>
            Why, and which days suit you?
          </label>
          <textarea id={`why-${visit.id}`} className="oa-input" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="oa-cta" style={{ width: 'auto', paddingInline: 18 }} disabled={busy || reason.trim().length < 3} onClick={() => void answer('move')}>
              Send
            </button>
            <button type="button" className="oa-cta outline" style={{ width: 'auto', paddingInline: 18 }} onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {msg ? <p className="oa-note" role="status" style={{ margin: 0 }}>{msg}</p> : null}
    </div>
  );
}
