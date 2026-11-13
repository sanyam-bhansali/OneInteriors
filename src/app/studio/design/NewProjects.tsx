'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { formatINR } from '@/lib/money';
import type { NewProjects as NewProjectsData, NewProjectCard } from '@/modules/studio-design/new-projects';
import { newProjectsLine } from '@/modules/studio-design/new-projects-rules';
import { assignNewProjectAction } from './new-project-actions';

/**
 * "New projects" (owner, 13 Nov 2026): "On Renuka's dashboard there should be
 * 'New project' so she knows there is a new project." Projects Convert made,
 * in design with no designer yet, oldest first, each with Assign designer.
 * Shown at the top of the design head's home and of the Design board; hidden
 * when there are none.
 */
export function NewProjects({ data }: { data: NewProjectsData }) {
  if (data.projects.length === 0) return null;
  return (
    <section className="card" aria-label="New projects" data-testid="new-projects" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderColor: 'var(--warn)' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17 }}>New projects</h2>
        <p className="muted sm" style={{ margin: '4px 0 0' }}>
          {newProjectsLine(data.projects.length)}. Pick who designs each one; they can open it straight away.
        </p>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
        {data.projects.map((p) => (
          <Row key={p.id} p={p} designers={data.designers} />
        ))}
      </ul>
      {data.designers.every((d) => d.role !== 'DESIGNER') ? <p className="muted sm" style={{ margin: 0 }}>Add designers in Settings, Team.</p> : null}
    </section>
  );
}

function Row({ p, designers }: { p: NewProjectCard; designers: NewProjectsData['designers'] }) {
  const [pick, setPick] = useState('');
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const done = message?.ok === true;
  return (
    <li style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--fill2)' }}>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <Link href={`/studio/projects/${p.id}?tab=design`} style={{ fontWeight: 600 }}>
          {p.client}
        </Link>
        <span className="muted sm"> · {p.flat}</span>
        <div className="hstack sm" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {p.category ? <span className="chip">{p.category}</span> : <span className="chip bad">No category</span>}
          {p.quote ? (
            <span className="muted">
              {p.quote.number}
              {p.quote.totalPaise !== null ? ` · ${formatINR(p.quote.totalPaise)}` : ''}
            </span>
          ) : null}
          <span className="muted">· {p.waiting}</span>
        </div>
        {p.handover ? (
          <p className="muted sm" style={{ margin: '6px 0 0', whiteSpace: 'pre-line' }}>
            From sales: {p.handover}
          </p>
        ) : null}
      </div>
      {done ? (
        <span role="status" className="sm" style={{ color: 'var(--good)' }}>
          {message?.text}
        </span>
      ) : (
        <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
          <select className="fld" style={{ width: 'auto', minHeight: 36, maxWidth: 220 }} value={pick} onChange={(e) => setPick(e.target.value)} aria-label={`Designer for ${p.client}`} disabled={pending}>
            <option value="">Pick a designer</option>
            {designers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.role !== 'DESIGNER' ? ` (${d.role === 'OWNER' ? 'owner' : 'project manager'})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn pri sm"
            disabled={pending || pick === ''}
            onClick={() =>
              start(async () => {
                try {
                  const r = await assignNewProjectAction(p.id, pick);
                  setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
                } catch {
                  setMessage({ ok: false, text: 'That did not go through. Check your connection and try again.' });
                }
              })
            }
          >
            {pending ? 'Assigning…' : 'Assign designer'}
          </button>
        </div>
      )}
      {message && !message.ok ? (
        <p role="alert" className="cl-err sm" style={{ flexBasis: '100%', margin: 0, color: 'var(--bad)' }}>
          {message.text}
        </p>
      ) : null}
    </li>
  );
}
