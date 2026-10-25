import Link from 'next/link';
import type { Metadata } from 'next';
import { designWorkload, type DesignerRow } from '@/modules/studio-design/store';
import { lifecycleBoard } from '@/modules/studio/lifecycle-store';
import { can, currentMember } from '@/modules/studio/access';
import { asLifeTab, LifecycleTabs } from './LifecycleTabs';
import '../projects/projects.css';

export const metadata: Metadata = { title: 'Design', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Design (Studio OS Phase 2, docs/studio-os/PHASE-2-DESIGN.md §8), now the
 * project lifecycle board (owner, 13 Oct 2026; docs/studio-os/PROJECT-LIFECYCLE.md):
 * three tabs, My Design, My Execution (with "N project closures remaining")
 * and My Snags. A designer sees their own projects; the owner and a PM see
 * theirs, and under Design every designer's load against a month.
 */

const muted = 'text-[12.5px] text-[var(--muted)]';
const dayWords = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '') : '';

export default async function DesignPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab: rawTab }, board, w, member] = await Promise.all([searchParams, lifecycleBoard().catch(() => null), designWorkload(), currentMember()]);
  if (!w && !board) {
    return (
      <div className="content oi-proj">
        <p className="m-0 text-[15px] text-[var(--text2)]">This page is for designers, the owner and project managers.</p>
      </div>
    );
  }
  const mine = board ? board.scope === 'designer' : !w?.everyone;
  const tab = asLifeTab(rawTab);
  return (
    <div className="content oi-proj">
      <div className="phead">
        <div>
          <h1>{mine ? 'My projects' : 'Projects by phase'}</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {mine
              ? 'Your projects from design to warranty: what is now, what is next and what is holding it up. Open one to tick steps, share drawings, close the project or see its snags.'
              : 'Every project from design to warranty, with what is holding each up, and every designer’s load.'}
          </p>
        </div>
        <div className="hstack">
          {/* Every late design step, whose delay and why (DESIGN-PROCESS-PLAN.md Decision 6). */}
          <Link href="/studio/design/delays" className="btn ghost">
            Delays
          </Link>
          {member && can(member, 'project.bringIn') ? (
            <Link href="/studio/projects/bring-in" className="btn sec">
              Bring in a running project
            </Link>
          ) : null}
        </div>
      </div>
      {board ? <LifecycleTabs board={board} tab={tab} base="/studio/design" mine={mine} /> : null}
      {/* The designers' load (Phase 2): owner and PM, under Design. */}
      {w && !mine && tab === 'design' ? (
        <>
          <h2 className="m-0 text-[17px]">Designers</h2>
          {w.designers.length === 0 ? (
            <div className="empty">
              <b>No designers yet.</b>
              <span className="muted">Add one in Settings, Team, with the Designer role.</span>
            </div>
          ) : null}
          {w.designers.map((d) => (
            <Designer key={d.id ?? 'nobody'} d={d} showLoad={d.id !== null} />
          ))}
        </>
      ) : null}
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
