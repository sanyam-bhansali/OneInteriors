import Link from 'next/link';
import type { Metadata } from 'next';
import { designWorkload, type DesignerRow } from '@/modules/studio-design/store';
import '../projects/projects.css';

export const metadata: Metadata = { title: 'Design', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Design (Studio OS Phase 2, docs/studio-os/PHASE-2-DESIGN.md §8). For the
 * owner and a PM: every designer, their projects still in design, steps due
 * this week and late, and a rough load against a month. For a designer: the
 * same page with only their own projects — their home after signing in.
 */

const muted = 'text-[12.5px] text-[var(--muted)]';
const dayWords = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '') : '';

export default async function DesignPage() {
  const w = await designWorkload();
  if (!w) {
    return (
      <div className="content oi-proj">
        <p className="m-0 text-[15px] text-[var(--text2)]">This page is for designers, the owner and project managers.</p>
      </div>
    );
  }
  const mine = !w.everyone;
  return (
    <div className="content oi-proj">
      <div className="phead">
        <div>
        <h1>
          {mine ? 'My design work' : 'Design'}{' '}
          <span className="mono muted" style={{ fontSize: 18 }}>
            {w.designers.reduce((n, d) => n + d.projects.length, 0)}
          </span>
        </h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          {mine
            ? 'Your projects still in design, with the next step of each. Open one to tick steps, share drawings and book visits.'
            : 'Every designer’s projects still in design, what is due this week and late, and a rough load against a 25-day month.'}
        </p>
        </div>
      </div>
      {w.designers.length === 0 ? (
        <div className="empty">
          <b>No designers yet.</b>
          <span className="muted">Add one in Settings, Team, with the Designer role.</span>
        </div>
      ) : null}
      {w.designers.map((d) => (
        <Designer key={d.id ?? 'nobody'} d={d} showLoad={!mine && d.id !== null} />
      ))}
    </div>
  );
}

function Designer({ d, showLoad }: { d: DesignerRow; showLoad: boolean }) {
  const over = d.load.pct > 100;
  return (
    <section className="card flush" aria-label={d.name}>
      <div className="chead">
        <h2>
          {d.name} <span className={muted}>· {d.projects.length} project{d.projects.length === 1 ? '' : 's'} in design</span>
        </h2>
        {showLoad ? (
          <span className="text-[13px] font-medium" style={{ color: over ? 'var(--bad)' : 'var(--text2)' }} title="Designer-days still needed (1 BHK 14, 2 BHK 20, 3 BHK 27, 4 BHK 32) against 25 working days a month">
            About {d.load.loadDays} of {d.load.capacityDays} days ({d.load.pct}%){over ? ' · too much for one month' : ''}
          </span>
        ) : null}
      </div>
      {showLoad ? (
        <div className="pbar mx-[18px] mb-3" aria-hidden="true">
          <i style={{ width: `${Math.min(100, d.load.pct)}%`, background: over ? 'var(--bad-s)' : 'var(--ink)' }} />
        </div>
      ) : null}
      {d.projects.length === 0 ? <p className={`m-0 px-[18px] pb-4 ${muted}`}>Nothing in design right now.</p> : null}
      <ul className="m-0 flex list-none flex-col p-0">
        {d.projects.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--fill2)] px-[18px] py-3 text-[14px]">
            <Link href={`/studio/projects/${p.id}?tab=design`} className="min-w-0 flex-1 basis-[220px] font-semibold">
              {p.home}
              <span className={`block font-normal ${muted}`}>
                {p.customer}
                {p.endsOn ? ` · design planned to end ${dayWords(p.endsOn)}` : ''}
              </span>
            </Link>
            <span className="chip mono">{p.pct}%</span>
            <span className="min-w-0 flex-1 basis-[220px] text-[13.5px]">
              {p.next ? (
                <>
                  Next: {p.next.label}
                  {p.next.plannedOn ? <span className={muted}> · {dayWords(p.next.plannedOn)}</span> : null}
                  {p.next.lockedBy ? <span className="text-[12.5px] text-[var(--warn)]"> · waiting for the {p.next.lockedBy}</span> : null}
                </>
              ) : (
                <span className={muted}>Every step ticked</span>
              )}
            </span>
            <span className="text-[12.5px]">
              {p.late ? <span className="chip bad"><span className="dot" />{p.late} late</span> : null}
              {p.late && p.due ? ' · ' : ''}
              {p.due ? <span className="text-[var(--text2)]">{p.due} due this week</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
