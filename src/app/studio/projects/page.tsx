import Link from 'next/link';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { studioProjects } from '@/modules/studio/workspace';
import { studioUpdateScore } from '@/modules/project/site-log';
import { can, currentMember } from '@/modules/studio/access';
import { ATTENTION_TITLES, clock, shortDay, type AttentionKind, type WorkspaceRow } from '@/modules/studio/workspace-view';
import { LineIcon } from '../ui/icons';
import { lifecycleBoard } from '@/modules/studio/lifecycle-store';
import { asLifeTab, LifecycleTabs } from '../design/LifecycleTabs';
import './projects.css';

export const metadata: Metadata = {
  title: 'Projects',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The studio's live customer projects, in the owner's handoff look
 * (StudioProjects.dc.html; StudioDesProjects / StudioPMProjects for the
 * designer's "My projects" and the PM's "All sites"): what needs the team
 * today, then a board of every project in the column of the stage it is in.
 *
 * Every card is a customer's project (`HomeProject`) with a customer app
 * behind it: what the studio records shows there. The data and who may see
 * what (money only for those who see money) come from studio/workspace.ts.
 */

const ACCENT: Record<AttentionKind, { bar: string; cls: string }> = {
  'no-update': { bar: 'var(--warn-s)', cls: 'warn-t' },
  'snag-overdue': { bar: 'var(--bad-s)', cls: 'bad-t' },
  payment: { bar: 'var(--acc)', cls: 'acc-t' },
  waiting: { bar: 'var(--ring)', cls: 'muted' },
};

const HANDED_OVER = 'Handed over';

/** The board's columns: each project in the stage under way, in the order the stages run (by stage kind, named as the studio names it). */
function lanesOf(rows: WorkspaceRow[]): { name: string; rows: WorkspaceRow[] }[] {
  const lanes = new Map<string, { name: string; at: number; rows: WorkspaceRow[] }>();
  for (const r of rows) r.stages.forEach((s, i) => {
    const l = lanes.get(s.key);
    if (!l) lanes.set(s.key, { name: s.label, at: i, rows: [] });
    else l.at = Math.min(l.at, i);
  });
  const over = { name: HANDED_OVER, at: 99, rows: [] as WorkspaceRow[] };
  for (const r of rows) {
    const now = r.stages.find((s) => s.state === 'now');
    (now ? lanes.get(now.key)! : over).rows.push(r);
  }
  return [...lanes.values(), ...(over.rows.length ? [over] : [])].sort((a, b) => a.at - b.at);
}

export default async function ProjectsPage({ searchParams }: { searchParams?: Promise<{ tab?: string; deleted?: string }> }) {
  const now = new Date();
  const [data, score, member, board, sp] = await Promise.all([
    studioProjects(now),
    studioUpdateScore(now), // score: Phase 2
    currentMember(),
    lifecycleBoard().catch(() => null),
    searchParams ?? Promise.resolve<{ tab?: string; deleted?: string }>({}),
  ]);
  const justDeleted = sp.deleted === '1';
  const rows = data?.rows ?? [];
  const live = rows.filter((r) => r.stage !== null);
  const own = new Set(data?.ownClientIds ?? []);
  const title = member?.role === 'DESIGNER' ? 'My projects' : member?.role === 'PM' ? 'All sites' : 'Projects';
  /* Owner or PM: one obvious way to start a project for a client of their own (OWN-CLIENTS.md). */
  const startButton = data?.canStart ? (
    <Link href="/studio/projects/start" className="btn pri">
      <LineIcon name="plus" size={17} />
      Start a project
    </Link>
  ) : null;
  /* Owner, PM, designer on Max: bring a project already running onto the platform (BRING-IN-PROJECTS.md). */
  const bringInButton =
    member && can(member, 'project.bringIn') ? (
      <Link href="/studio/projects/bring-in" className="btn sec">
        Bring in a running project
      </Link>
    ) : null;
  const lanes = lanesOf(rows);
  /* Delete and restore (owner, 27 Oct 2026; studio/project-delete.ts). */
  const deletedLink =
    member?.role === 'OWNER' ? (
      <Link href="/studio/projects/deleted" className="btn ghost">
        Deleted projects
      </Link>
    ) : null;

  return (
    <div className="content oi-proj">
      <div className="phead">
        <div>
          <h1>
            {title} <span className="mono muted" style={{ fontSize: 18 }}>{rows.length}</span>
          </h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Each project shows in its customer&rsquo;s app. What your team records here is what they see.
          </p>
          <p className="muted sm" style={{ margin: '4px 0 0' }}>
            {shortDay(now)} · {live.length === 0 ? 'Nothing running yet.' : `${live.length} live`}
            {score && score.pct !== null
              ? ` · Daily site updates: ${score.pct}% of working days, last 30 days${score.streakMissed >= 2 ? ` · ${score.streakMissed} days in a row missed on a site` : ''}`
              : ''}
          </p>
        </div>
        {startButton || bringInButton || deletedLink ? (
          <div className="hstack">
            {deletedLink}
            {bringInButton}
            {startButton}
          </div>
        ) : null}
      </div>
      {justDeleted ? (
        <p role="status" className="ox-ok" style={{ margin: 0 }}>
          Project deleted. It is in Deleted projects if you need it back.
        </p>
      ) : null}

      {/* My Design · My Execution · My Snags (owner and Hauspire's design team, 24 Oct 2026; DESIGN-PROCESS-PLAN.md §2.3): every project by its phase, for everyone who has the board. */}
      {board && rows.length > 0 ? <LifecycleTabs board={board} tab={asLifeTab(sp.tab)} base="/studio/projects" mine={board.scope === 'designer'} /> : null}

      {rows.length === 0 ? (
        <div className="empty">
          <b>A project starts when a customer signs your final quote.</b>
          <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--text2)]">
            Signing builds the plan from the quote — the stages, each room&rsquo;s checklist, the payment stages and the materials — and the
            customer follows it in their app. Projects you are on appear here.
          </p>
          {startButton ? (
            <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--text2)]">
              A client of your own has accepted your quotation? Start their project from it, and invite them to follow it in the app.{' '}
              <Link href="/studio/projects/start" className="acc-t font-medium">
                Start a project
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <section aria-labelledby="h-attn" className="flex flex-col gap-2.5">
            <h2 id="h-attn" className="m-0 text-[17px] font-semibold">
              Needs attention today
            </h2>
            {data!.attention.length === 0 ? (
              <p className="m-0 muted">Nothing. Every live site has posted today and nothing is overdue.</p>
            ) : (
              <div className="attn">
                {data!.attention.map((a, i) => (
                  <Link key={`${a.kind}-${a.projectId}-${i}`} href={`/studio/projects/${a.projectId}`} style={{ boxShadow: `inset 4px 0 0 ${ACCENT[a.kind].bar}` }}>
                    <span className={`sm ${ACCENT[a.kind].cls}`} style={{ fontWeight: 600 }}>
                      {ATTENTION_TITLES[a.kind]}
                    </span>
                    <b>{a.home}</b>
                    <span className="muted sm">{a.text}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <div className="hstack" style={{ justifyContent: 'space-between' }}>
            <h2 className="m-0 text-[17px] font-semibold">By stage</h2>
            <span className="muted sm">Columns are the stages every project goes through.</span>
          </div>

          <div className="board" role="list" aria-label="Projects by stage" style={{ ['--lanes' as string]: lanes.length }}>
            {lanes.map((l) => (
              <section key={l.name} role="listitem" aria-label={l.name}>
                <div className="colh">
                  {l.name}
                  <span className="mono">{l.rows.length}</span>
                </div>
                <div className="lane">
                  {l.rows.map((r) => (
                    <Card key={r.id} r={r} money={data!.seesMoney} own={own.has(r.id)} />
                  ))}
                  {l.rows.length === 0 ? (
                    <span className="muted sm" style={{ padding: 10 }}>
                      Nothing in this stage
                    </span>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Card({ r, money, own }: { r: WorkspaceRow; money: boolean; own: boolean }) {
  const handedOver = r.stage === null;
  const done = r.stages.filter((s) => s.state === 'done').length;
  const prog = r.stages.length ? Math.round((done / r.stages.length) * 100) : 0;
  const health =
    r.lateDays > 0
      ? { cls: r.customerLateDays === r.lateDays ? 'warn' : 'bad', text: `${r.lateDays} day${r.lateDays === 1 ? '' : 's'} late` }
      : { cls: 'good', text: handedOver ? 'Done' : 'On track' };
  const today = handedOver
    ? null
    : !r.started
      ? { cls: '', text: 'Not started' }
      : r.postedToday
        ? { cls: 'good', text: `Posted ${clock(r.postedToday)}` }
        : { cls: 'warn', text: 'Not posted yet' };
  const w = r.waiting[0] ?? null;
  return (
    <Link href={`/studio/projects/${r.id}`} className="pcard">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <b style={{ fontSize: 14.5, fontWeight: 600 }}>{r.home}</b>
        <span className={`chip ${r.plan === 'assured' ? 'oi' : ''}`}>{r.plan === 'assured' ? 'Assured' : 'Basic'}</span>
      </div>
      <span className="muted sm">
        {r.customer}
        {own ? ' · your own client' : ''}
        {r.stage ? (
          <>
            {' · '}
            <span className="mono">
              day {r.stage.day} of {r.stage.of}
            </span>
          </>
        ) : null}
      </span>
      <div className="pbar" role="img" aria-label={`${done} of ${r.stages.length} stages done`}>
        <i style={{ width: `${prog}%` }} />
      </div>
      <div className="hstack" style={{ gap: 6 }}>
        <span className={`chip ${health.cls}`}>
          <span className="dot" />
          {health.text}
        </span>
        {today ? <span className={`chip ${today.cls}`}>{today.text}</span> : null}
      </div>
      {r.customerLateDays > 0 ? (
        <span className="muted sm">
          {r.customerLateDays === r.lateDays ? 'All' : r.customerLateDays} from {r.customer}, not yours
        </span>
      ) : null}
      {r.snags.overdue.length ? (
        <span className="sm bad-t">
          You: {r.snags.overdue.length} snag{r.snags.overdue.length === 1 ? '' : 's'} overdue
        </span>
      ) : r.snags.open ? (
        <span className="sm">
          {r.snags.open} snag{r.snags.open === 1 ? '' : 's'} open
        </span>
      ) : null}
      {w ? (
        <span className="muted sm">
          {r.customer}: {w.title}, due {shortDay(w.dueOn)}
          {r.waiting.length > 1 ? ` · ${r.waiting.length - 1} more` : ''}
        </span>
      ) : null}
      {money && r.nextPayment ? (
        <span className="sm" style={r.nextPayment.toRecord ? { color: 'var(--bad)' } : undefined}>
          {r.nextPayment.toRecord ? 'You: record ' : 'Next: '}
          {r.nextPayment.label.toLowerCase()} <span className="mono">{formatINR(r.nextPayment.amountPaise)}</span>
          {!r.nextPayment.toRecord && r.nextPayment.dueOn ? ` · ${shortDay(new Date(`${r.nextPayment.dueOn}T12:00:00Z`))}` : ''}
        </span>
      ) : null}
    </Link>
  );
}
