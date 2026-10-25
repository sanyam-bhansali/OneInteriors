import Link from 'next/link';
import { formatINR } from '@/lib/money';
import { remainingLine } from '@/modules/project/lifecycle-rules';
import { dayWords } from '@/modules/project/lifecycle-card';
import type { BoardCard, LifecycleBoard } from '@/modules/studio/lifecycle-store';
import '../projects/projects.css';
import './lifecycle.css';

/**
 * The project lifecycle board (owner, 13 Oct 2026; docs/studio-os/PROJECT-LIFECYCLE.md):
 * My Design, My Execution, My Snags. Each card: client, flat, current step,
 * next step, what is blocking it (client or studio side) and late days.
 * My Execution opens with "You have N project closures remaining". Server
 * component; the tab is in the URL (?tab=).
 */

export type LifeTab = 'design' | 'execution' | 'snags';
export const LIFE_TABS: readonly LifeTab[] = ['design', 'execution', 'snags'];
export const asLifeTab = (v: string | undefined): LifeTab => (LIFE_TABS.includes(v as LifeTab) ? (v as LifeTab) : 'design');

export function LifecycleTabs({ board, tab, base, mine }: { board: LifecycleBoard; tab: LifeTab; base: string; mine: boolean }) {
  const label: Record<LifeTab, string> = mine
    ? { design: 'My Design', execution: 'My Execution', snags: 'My Snags' }
    : { design: 'Design', execution: 'Execution', snags: 'Snags' };
  const counts: Record<LifeTab, number> = { design: board.design.length, execution: board.execution.length, snags: board.snags.length };
  const cards = board[tab];
  return (
    <div className="oi-life">
      <nav role="tablist" aria-label="Projects by phase" className="ptabs">
        {LIFE_TABS.map((t) => (
          <Link key={t} role="tab" aria-selected={t === tab} href={`${base}?tab=${t}`}>
            {label[t]}
            <span className="mono">{counts[t]}</span>
          </Link>
        ))}
      </nav>

      {tab === 'execution' && board.closures.length > 0 ? (
        <section className="remind" role="status" aria-label="Project closures remaining" data-testid="closures-remaining">
          <b>{remainingLine(board.closures.length)}</b>
          <span className="sm">Past provisional handover and not closed out. Work out the final payment on each.</span>
          <ul>
            {board.closures.map((c) => (
              <li key={c.id}>
                <Link href={`/studio/projects/${c.id}?tab=closure`}>
                  {c.client} · {c.flat}
                </Link>
                {c.provisionalOn ? <span className="sm"> · handed over {dayWords(c.provisionalOn)}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Change orders (15 Oct 2026): extra work paid and ready to go to the factory. */}
      {tab === 'execution' && board.execution.some((c) => c.extras.toRelease > 0) ? (
        <section className="remind" role="status" aria-label="Extra work to release" data-testid="extras-to-release">
          <b>
            {board.execution.reduce((n, c) => n + c.extras.toRelease, 0)} extra work order{board.execution.reduce((n, c) => n + c.extras.toRelease, 0) === 1 ? '' : 's'} paid and ready to release
          </b>
          <ul>
            {board.execution
              .filter((c) => c.extras.toRelease > 0)
              .map((c) => (
                <li key={c.id}>
                  <Link href={`/studio/projects/${c.id}?tab=extras`}>
                    {c.client} · {c.flat}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {cards.length === 0 ? (
        <div className="empty">
          <b>{tab === 'design' ? 'Nothing in design.' : tab === 'execution' ? 'Nothing on site.' : 'No snags to close.'}</b>
          <span className="muted">
            {tab === 'design'
              ? 'Projects move to execution when the design is signed off.'
              : tab === 'execution'
                ? 'A project comes here once its design is signed off, and stays until it is closed out.'
                : 'A project comes here once it is closed out, and stays through its warranty.'}
          </span>
        </div>
      ) : (
        <div className="lgrid">
          {cards.map((c) => (
            <ProjectCard key={c.id} c={c} tab={tab} showDesigner={!mine} />
          ))}
        </div>
      )}
      {board.closed.length > 0 && tab === 'snags' ? <p className="muted sm m-0">{board.closed.length} project{board.closed.length === 1 ? '' : 's'} closed (warranty over).</p> : null}
    </div>
  );
}

function ProjectCard({ c, tab, showDesigner }: { c: BoardCard; tab: LifeTab; showDesigner: boolean }) {
  const href = `/studio/projects/${c.id}?tab=${c.phase === 'CLOSURE' ? 'closure' : tab === 'design' ? 'design' : tab === 'snags' ? 'snags' : 'plan'}`;
  const tone = c.phase === 'CLOSURE' ? 'warn' : c.phase === 'WARRANTY' ? 'good' : c.phase === 'SNAGS' ? 'bad' : 'oi';
  return (
    <Link href={href} className="card lcard" data-testid="life-card" data-phase={c.phase}>
      <div className="lhead">
        <span className="min-w-0">
          <b>{c.client}</b>
          {c.priority ? (
            <span className="ml-1 text-[var(--warn)]" title={`Priority ${c.priority} of 5`} aria-label={`Priority ${c.priority} of 5`}>
              {'★'.repeat(c.priority)}
            </span>
          ) : null}
          <span className="muted sm">
            {c.category ? `${c.category} · ` : ''}
            {c.flat}
            {showDesigner && c.designer ? ` · ${c.designer}` : ''}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className={`chip ${tone}`}>{c.phaseLabel}</span>
          {c.lateDays > 0 ? (
            <span className="chip bad">
              <span className="dot" />
              {c.lateDays} day{c.lateDays === 1 ? '' : 's'} late
            </span>
          ) : null}
        </span>
      </div>
      <dl className="lrows">
        <dt>Now</dt>
        <dd>{c.current}</dd>
        {c.next ? (
          <>
            <dt>Next</dt>
            <dd className="muted">{c.next}</dd>
          </>
        ) : null}
        {c.extras.withClient + c.extras.toPay + c.extras.toRelease > 0 ? (
          <>
            <dt>Extra work</dt>
            <dd data-testid="life-card-extras">
              {[
                c.extras.withClient ? `${c.extras.withClient} with the client` : null,
                c.extras.toPay ? `${c.extras.toPay} approved, to be paid` : null,
                c.extras.toRelease ? `${c.extras.toRelease} ready to release` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </dd>
          </>
        ) : null}
        <dt>Blocking</dt>
        <dd>
          {c.blocker ? (
            <>
              <span className={`who ${c.blocker.side === 'client' ? 'warn-t' : 'acc-t'}`}>{c.blocker.side === 'client' ? 'Client' : 'Studio'}</span>
              {c.blocker.text}
            </>
          ) : (
            <span className="muted">Nothing</span>
          )}
        </dd>
        {c.finalDuePaise !== null ? (
          <>
            <dt>Final</dt>
            <dd className="mono">{formatINR(c.finalDuePaise)}</dd>
          </>
        ) : null}
      </dl>
      {tab === 'snags' && c.snags.length ? (
        <ul className="snl" aria-label="Open snags">
          {c.snags.slice(0, 6).map((s) => (
            <li key={s.id}>
              <span className="min-w-0">
                {s.warranty ? <span className="chip warn mr-1.5">Warranty</span> : null}
                {s.title}
                {s.room ? <span className="muted"> · {s.room}</span> : null}
              </span>
              <span className="muted sm">{s.state === 'fixed' ? 'fixed, client to confirm' : s.state}</span>
            </li>
          ))}
          {c.snags.length > 6 ? <li className="muted sm">and {c.snags.length - 6} more</li> : null}
        </ul>
      ) : null}
    </Link>
  );
}
