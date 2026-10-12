'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { MyProject } from '@/components/app/useMyProject';
import { formatINR } from '@/lib/money';
import { shortDate } from '@/modules/app/project-view';

/**
 * The design phase on the website (Studio OS Phase 2,
 * docs/studio-os/PHASE-2-DESIGN.md §7): how far the design is, what is next
 * and which payment opens it, the site visit, the mood board to fill, the
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
  const visit = design.visits.find((v) => v.status === 'booked') ?? null;
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

      {visit ? (
        <div className="oa-row" style={{ cursor: 'default' }}>
          <span>
            <span className="oa-row-title">Site visit: {visit.purpose}</span>
            <span className="oa-row-sub">{when(visit.at)}</span>
          </span>
        </div>
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

      <details>
        <summary className="oa-meta" style={{ cursor: 'pointer', color: 'var(--accent-ink)' }}>
          {design.steps.filter((s) => s.done).length} of {design.steps.length} design steps done
        </summary>
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
      </details>

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
        body: JSON.stringify({ verdict, comment: verdict === 'CHANGES' ? comment : '' }),
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
  const state = d.state === 'approved' ? 'Approved' : d.state === 'changes' ? 'Changes asked' : d.state === 'waiting' ? 'Waiting for your answer' : 'Shared';
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
        <span className="oa-meta">{d.version > 1 ? `Version ${d.version}` : d.kindLabel}</span>
      </div>
      <span className="oa-meta" style={{ color: d.state === 'waiting' ? 'var(--accent-ink)' : undefined }}>
        {state}
        {d.comment ? ` · “${d.comment}”` : ''}
      </span>
      {owner && d.state === 'waiting' && !asking ? (
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
