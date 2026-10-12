import Link from 'next/link';
import type { Metadata } from 'next';
import { designWorkload, type DesignerRow } from '@/modules/studio-design/store';

export const metadata: Metadata = { title: 'Design', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Design (Studio OS Phase 2, docs/studio-os/PHASE-2-DESIGN.md §8). For the
 * owner and a PM: every designer, their projects still in design, steps due
 * this week and late, and a rough load against a month. For a designer: the
 * same page with only their own projects — their home after signing in.
 */

const muted = 'text-[12.5px] text-[var(--s-ink-3)]';
const dayWords = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '') : '';

export default async function DesignPage() {
  const w = await designWorkload();
  if (!w) {
    return (
      <div className="px-5 py-6 sm:px-7">
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">This page is for designers, the owner and project managers.</p>
      </div>
    );
  }
  const mine = !w.everyone;
  return (
    <>
      <div className="border-b border-[var(--s-rule)] bg-[var(--s-rail)]/50 px-5 py-4 sm:px-7">
        <h1 className="m-0 text-[22px] font-semibold tracking-tight">{mine ? 'My design work' : 'Design'}</h1>
        <p className={`m-0 mt-1 ${muted}`}>
          {mine
            ? 'Your projects still in design, with the next step of each. Open one to tick steps, share drawings and book visits.'
            : 'Every designer’s projects still in design, what is due this week and late, and a rough load against a 25-day month.'}
        </p>
      </div>
      <div className="flex flex-col gap-5 px-5 py-6 sm:px-7">
        {w.designers.length === 0 ? <p className="m-0 text-[14.5px] text-[var(--s-ink-2)]">No designers yet. Add one in Settings, Team, with the Designer role.</p> : null}
        {w.designers.map((d) => (
          <Designer key={d.id ?? 'nobody'} d={d} showLoad={!mine && d.id !== null} />
        ))}
      </div>
    </>
  );
}

function Designer({ d, showLoad }: { d: DesignerRow; showLoad: boolean }) {
  const over = d.load.pct > 100;
  return (
    <section className="s-card flex flex-col gap-3 p-5" aria-label={d.name}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[16px] font-semibold">
          {d.name} <span className={muted}>· {d.projects.length} project{d.projects.length === 1 ? '' : 's'} in design</span>
        </h2>
        {showLoad ? (
          <span className="text-[13px] font-medium" style={{ color: over ? 'var(--s-bad)' : 'var(--s-ink-2)' }} title="Designer-days still needed (1 BHK 14, 2 BHK 20, 3 BHK 27, 4 BHK 32) against 25 working days a month">
            About {d.load.loadDays} of {d.load.capacityDays} days ({d.load.pct}%){over ? ' · too much for one month' : ''}
          </span>
        ) : null}
      </div>
      {showLoad ? (
        <div className="h-2 overflow-hidden rounded-full bg-[var(--s-rule)]" aria-hidden="true">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.load.pct)}%`, background: over ? 'var(--s-bad)' : 'var(--s-accent)' }} />
        </div>
      ) : null}
      {d.projects.length === 0 ? <p className={`m-0 ${muted}`}>Nothing in design right now.</p> : null}
      <ul className="m-0 flex list-none flex-col p-0">
        {d.projects.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--s-rule)] py-2.5 text-[14px]">
            <Link href={`/studio/projects/${p.id}?tab=design`} className="min-w-0 flex-1 basis-[220px] font-semibold text-[var(--s-ink)] no-underline hover:text-[var(--s-accent)]">
              {p.home}
              <span className={`block font-normal ${muted}`}>
                {p.customer}
                {p.endsOn ? ` · design planned to end ${dayWords(p.endsOn)}` : ''}
              </span>
            </Link>
            <span className="s-num w-[48px] font-[family-name:var(--font-mono)] text-[13px] text-[var(--s-accent)]">{p.pct}%</span>
            <span className="min-w-0 flex-1 basis-[220px] text-[13.5px]">
              {p.next ? (
                <>
                  Next: {p.next.label}
                  {p.next.plannedOn ? <span className={muted}> · {dayWords(p.next.plannedOn)}</span> : null}
                  {p.next.lockedBy ? <span className="text-[12.5px] text-[var(--s-warn)]"> · waiting for the {p.next.lockedBy}</span> : null}
                </>
              ) : (
                <span className={muted}>Every step ticked</span>
              )}
            </span>
            <span className="text-[12.5px]">
              {p.late ? <span className="font-medium text-[var(--s-bad)]">{p.late} late</span> : null}
              {p.late && p.due ? ' · ' : ''}
              {p.due ? <span className="text-[var(--s-ink-2)]">{p.due} due this week</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
