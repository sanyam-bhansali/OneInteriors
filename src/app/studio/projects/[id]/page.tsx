import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { projectWorkspace, TEAM_NOTES_MAX, type ProjectWorkspace, type WorkspaceStage } from '@/modules/studio/workspace';
import { clock, istDay, shortDay } from '@/modules/studio/workspace-view';
import { OnlyYourTeam } from '../marks';
import { TeamNotes } from './TeamNotes';
import { SiteLogTab } from './SiteLogTab';
import { SnagsTab as SnagsPanel } from './SnagsTab';
/* Phase 5: payments from the rows, the customer's decisions, the locker (project/payments-flow.ts, decision-flow.ts, locker.ts). */
import { PaymentsTab as PaymentsPanel } from './PaymentsTab';
import { DecisionsCard } from './DecisionsCard';
import { LockerCard } from './LockerCard';
import { PlanTab as PlanEditor } from './PlanTab';
import { planForStudio } from '@/modules/project/plan-edit';
import { studioDecisions } from '@/modules/project/decision-flow';
import { InviteBanner } from './InviteBanner';
import { broughtInOf } from '@/modules/studio-bring-in/bring-in';
/* Studio OS Phase 2: the design phase (modules/studio-design). */
import { DesignTab as DesignSection } from './DesignTab';
import { currentMember } from '@/modules/studio/access';
import { SITE_HOME, mayOpen } from '@/modules/studio/surfaces';
/* Studio OS Phase 3: the site crews' work orders (modules/studio-crews). */
import { CrewsTab as CrewsSection } from './CrewsTab';
import { can as roleCan } from '@/modules/studio/roles';
import { LineIcon } from '../../ui/icons';
/* The project lifecycle (docs/studio-os/PROJECT-LIFECYCLE.md): the phase and the closure. */
import { projectPhaseFor } from '@/modules/studio/lifecycle-store';
import { snagWindowFor } from '@/modules/project/snag-window-store';
import { closureFor } from '@/modules/project/closure';
import { ClosurePanel } from './ClosurePanel';
/* Change orders and client sign-off (owner, 15 Oct 2026; project/change-orders.ts, project/signoffs.ts). */
import { extrasForStudio } from '@/modules/project/change-orders';
import { signoffsForStudio } from '@/modules/project/signoffs';
import { ExtrasPanel } from './ExtrasPanel';
import { SignoffCard } from './SignoffCard';
import '../projects.css';

export const metadata: Metadata = { title: 'Project', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * One customer project, from the studio's office, in the owner's handoff
 * look (StudioProject.dc.html; StudioDesProject / StudioPMProject are the
 * same screen for the designer and the PM, scoped below by role).
 *
 * - Pill tabs: Plan, Design, Site log, Snags, Payments (only for those who
 *   see money), Crews (those who read work orders; a designer too since the
 *   lifecycle), Closure (from the provisional handover, for those who see money).
 * - The phase chip (project lifecycle): Design, Execution, Project closure,
 *   Snags, Warranty until …, Closed.
 * - The dark card is the customer projection itself
 *   (portal/customer-project.ts), so it shows what the app shows: the stages
 *   and only the starred steps.
 *
 * Everything the customer sees carries a "sees this" marker; the team's own
 * notes sit in the grey "Only your team" card.
 */

const TABS = [
  { key: 'plan', label: 'Plan' },
  { key: 'design', label: 'Design' },
  { key: 'log', label: 'Site log' },
  { key: 'snags', label: 'Snags' },
  { key: 'payments', label: 'Payments' },
  { key: 'crews', label: 'Crews' },
  /* The project lifecycle (owner, 13 Oct 2026): the closure, from the provisional handover on, for those who see the money. */
  { key: 'closure', label: 'Closure' },
  /* Change orders (owner, 15 Oct 2026): extra work after design sign-off, for those who see the money. */
  { key: 'extras', label: 'Extra work' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const iso = (d: string) => shortDay(new Date(d));

export default async function ProjectWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; started?: string }>;
}) {
  const [{ id }, { tab: rawTab, started }] = await Promise.all([params, searchParams]);
  const now = new Date();
  const r = await projectWorkspace(id.slice(0, 64), now);
  if (!r.ok) {
    if (r.error === 'That project is not one of yours.') notFound();
    return (
      <div className="content oi-proj">
        <p className="m-0 text-[15px] text-[var(--text2)]">{r.error}</p>
      </div>
    );
  }
  const w = r.workspace;
  const money = w.contractPaise !== null;
  const me = await currentMember();
  const broughtIn = me ? await broughtInOf(w.id, me.studioId).catch(() => null) : null;
  const [viewer, decisions, life, closure, snagWin] = await Promise.all([
    currentMember(),
    studioDecisions(w.id, now),
    projectPhaseFor(w.id, now),
    closureFor(w.id, now),
    /* The snag window (owner, 15 Oct 2026; project/snag-window.ts): from the handover payment, the studio's days. */
    snagWindowFor(w.id).catch(() => null),
  ]);
  /* Change orders and sign-offs: null for those who do not see the project's money. */
  const [extras, signoffs] = await Promise.all([extrasForStudio(w.id).catch(() => null), signoffsForStudio(w.id).catch(() => null)]);
  const closureOpen = closure !== null && life !== null && life.phase !== 'DESIGN' && life.phase !== 'PRE_EXECUTION' && life.phase !== 'EXECUTION';
  // Studio OS Phase 3: Crews for those who see work orders (owner, PM, accounts; a designer on their project since the lifecycle).
  const crews = viewer === null || roleCan(viewer, 'workorder.read', { assigned: true });
  const tabs = TABS.filter((t) => (t.key !== 'payments' || money) && (t.key !== 'crews' || crews) && (t.key !== 'closure' || closureOpen) && (t.key !== 'extras' || (extras !== null && money && (life?.phase !== 'DESIGN' || extras.extras.length > 0))));
  // A designer (Studio OS Phase 2) opens on the Design tab.
  const fallback: Tab = viewer?.role === 'DESIGNER' ? 'design' : 'plan';
  const tab: Tab = tabs.some((t) => t.key === rawTab) ? (rawTab as Tab) : fallback;
  const counts: Record<Tab, string | null> = {
    plan: `${w.stages.length} stages`,
    design: null,
    log: null, // Phase 2: the Site log tab counts its own days
    snags: `${w.work?.snags.filter((s) => s.status === 'OPEN').length ?? 0} open`,
    payments: w.work?.money ? `${w.work.money.stages.length}` : null,
    crews: null,
    closure: life?.phase === 'CLOSURE' ? 'to do' : null,
    extras: extras ? `${extras.extras.filter((e) => e.status !== 'CANCELLED').length}` : null,
  };
  const siteMode = viewer !== null && mayOpen(viewer, SITE_HOME);
  const appLine = w.appConnected
    ? 'Customer app connected'
    : w.ownClient && !w.customerJoined
      ? 'Invited, not joined yet'
      : w.customerJoined
        ? 'Customer signed in, app not on a phone yet'
        : 'Customer app not on a phone yet';

  return (
    <div className="content oi-proj">
      <div className="wshead">
        <div className="flex min-w-0 flex-col gap-2">
          <Link href="/studio/projects" className="back">
            ← Projects
          </Link>
          <h1>{w.home}</h1>
          <div className="flex flex-wrap gap-2">
            <span className="chip">{w.customer}</span>
            {w.ownClient ? (
              <span className="chip" title="Not introduced by One Interiors: no introduction, no commission">
                Your own client
              </span>
            ) : null}
            {w.bhk || w.tier ? <span className="chip">{[w.bhk, w.tier].filter(Boolean).join(' · ')}</span> : null}
            {money ? (
              <span className="chip mono">
                {formatINR(w.contractPaise!)}
                {w.signedAt ? ` · signed ${shortDay(w.signedAt)}` : ''}
              </span>
            ) : null}
            <span className={`chip ${w.plan === 'assured' ? 'oi' : ''}`}>
              {w.plan === 'assured' ? 'Assured' : w.assuredRequested ? 'Basic · asked for Assured' : 'Basic'}
            </span>
            <span className={`chip ${w.appConnected ? 'good' : ''}`}>{appLine}</span>
            {life ? (
              <span className={`chip ${life.phase === 'CLOSURE' ? 'warn' : life.phase === 'WARRANTY' ? 'good' : life.phase === 'SNAGS' ? 'bad' : 'ink'}`} data-testid="phase-chip">
                {life.label}
                {life.phase === 'WARRANTY' && life.warrantyEndsOn ? ` until ${shortDay(new Date(`${life.warrantyEndsOn}T00:00:00Z`))}` : ''}
              </span>
            ) : null}
            {snagWin && life && (life.phase === 'CLOSURE' || life.phase === 'SNAGS') ? (
              <span className={`chip ${snagWin.endsOn < istDay(now) ? 'warn' : ''}`} data-testid="snag-window-chip" title="The client raises snags in the app from the handover payment for the days set in Settings, Warranty">
                {snagWin.endsOn < istDay(now) ? `Snag window closed ${shortDay(new Date(`${snagWin.endsOn}T00:00:00Z`))}` : `Client can raise snags until ${shortDay(new Date(`${snagWin.endsOn}T00:00:00Z`))}`}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {siteMode ? (
            <Link href={SITE_HOME} className="btn wsbtn paper">
              Open site mode
            </Link>
          ) : null}
          {decisions?.canCreate ? (
            <Link href={`/studio/projects/${w.id}/decisions/new`} className="btn pri wsbtn">
              New decision for {w.customerFirst}
            </Link>
          ) : null}
        </div>
      </div>

      {w.invite && (!w.customerJoined || started === '1') ? (
        <InviteBanner
          projectId={w.id}
          customer={w.customerFirst}
          link={w.invite.link}
          code={w.invite.code}
          sentVia={w.invite.sentVia}
          messages={w.invite.messages}
          joined={w.customerJoined}
          justStarted={started === '1'}
          canResend={w.canInvite}
        />
      ) : null}

      {broughtIn ? (
        <p className="muted sm" style={{ margin: 0 }}>
          {broughtIn.line} on {broughtIn.on}. Steps done before that are marked &ldquo;Done before joining One Interiors&rdquo;.
        </p>
      ) : null}

      <nav role="tablist" aria-label="Project sections" className="ptabs">
        {tabs.map((t) => (
          <Link key={t.key} role="tab" aria-selected={t.key === tab} href={`/studio/projects/${w.id}?tab=${t.key}`}>
            {t.label}
            {counts[t.key] !== null ? <span className="mono">{counts[t.key]}</span> : null}
          </Link>
        ))}
      </nav>

      <div className="wscols">
        <div className="wsmain">
          {tab === 'plan' ? <PlanSection w={w} now={now} /> : null}
          {tab === 'design' ? <DesignSection projectId={w.id} now={now} /> : null}
          {/* Phase 2: the daily site log (SiteLogTab.tsx), with the old notes under it. */}
          {tab === 'log' ? <SiteLogTab projectId={w.id} customer={w.customerFirst} now={now} legacy={w.updates} /> : null}
          {tab === 'snags' ? <SnagsPanel projectId={w.id} now={now} /> : null}
          {tab === 'payments' ? <PaymentsPanel projectId={w.id} customer={w.customerFirst} /> : null}
          {tab === 'crews' ? <CrewsSection projectId={w.id} now={now} /> : null}
          {tab === 'closure' && closure ? <ClosurePanel view={closure} customer={w.customerFirst} /> : null}
          {tab === 'extras' && extras ? <ExtrasPanel data={extras} customer={w.customerFirst} /> : null}
        </div>
        <aside className="wsside" aria-label={`What ${w.customerFirst} sees`}>
          <CustomerPanel w={w} now={now} />
          {decisions ? <DecisionsCard data={decisions} customer={w.customerFirst} /> : null}
          {signoffs ? <SignoffCard data={signoffs} customer={w.customerFirst} /> : null}
          <LockerCard projectId={w.id} customer={w.customerFirst} />
          <OnlyYourTeam>
            <TeamNotes projectId={w.id} initial={w.teamNotes} canEdit={w.canEditNotes} max={TEAM_NOTES_MAX} />
          </OnlyYourTeam>
        </aside>
      </div>
    </div>
  );
}

function stateLine(s: WorkspaceStage): { text: string; tone: string } {
  if (s.state === 'done') return { text: 'Done', tone: 'var(--good)' };
  if (s.late) return { text: `Late · was due ${shortDay(s.targetOn)}`, tone: 'var(--bad-s)' };
  if (s.state === 'now') return { text: 'Now · on track', tone: 'var(--good)' };
  return { text: s.state === 'next' ? 'Next' : 'Later', tone: 'var(--muted)' };
}

/** Phase 3: the editable plan when it was built from the quote; the read-only standard stages otherwise. */
async function PlanSection({ w, now }: { w: ProjectWorkspace; now: Date }) {
  const r = w.hasPlan ? await planForStudio(w.id, now) : null;
  if (r?.ok && r.plan) return <PlanEditor plan={r.plan} customer={w.customerFirst} />;
  return <PlanTab w={w} />;
}

function PlanTab({ w }: { w: ProjectWorkspace }) {
  return (
    <section aria-label="Plan" className="card flush">
      <div className="chead">
        <div className="flex flex-col gap-[3px]">
          <h2>Plan</h2>
          <span className="muted sm">
            {w.hasPlan
              ? `Made from the signed quote: ${w.materials} material${w.materials === 1 ? '' : 's'} listed. A stage finishes when the site ticks its last step, with a photo.`
              : 'Signed before plans were built from the quote, so this shows the standard stages. Its plan is built once the backfill runs.'}
          </span>
        </div>
        {/* The client sees the stages and only the starred steps; the rest stays with the team. */}
        <span className="sees">{w.customerFirst} sees the stages and ★ steps only</span>
      </div>
      <div className="oi-prow oi-prow-h">
        <span>Stage</span>
        <span>Planned</span>
        <span>Status</span>
        <span />
      </div>
      <ol className="m-0 flex list-none flex-col p-0">
        {w.stages.map((s, i) => {
          const st = stateLine(s);
          return (
            <li key={`${s.key}-${i}`} className={`oi-stage${s.state === 'now' ? ' now' : ''}`}>
              <div className="oi-prow">
                <span className="font-semibold">{s.label}</span>
                <span className="mono">{shortDay(s.targetOn)}</span>
                <span className="font-medium" style={{ color: st.tone }}>
                  {st.text}
                </span>
                <span />
              </div>
              {s.rooms.length ? (
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                  {s.rooms.map((room) => (
                    <div key={room.room} className="flex flex-col">
                      <span className="py-1.5 text-[13px] font-semibold text-[var(--muted)]">{room.room}</span>
                      {room.items.map((it, k) => (
                        <div key={k} className="oi-ci">
                          <span aria-hidden="true" className="oi-box" style={it.done ? { background: 'var(--good-s)' } : { boxShadow: 'inset 0 0 0 1.5px var(--ring)' }}>
                            {it.done ? '✓' : ''}
                          </span>
                          <span className={it.done ? 'text-[var(--muted)]' : undefined}>
                            {it.label}
                            <span className="sr-only">{it.done ? ' (done)' : ' (open)'}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CustomerPanel({ w, now }: { w: ProjectWorkspace; now: Date }) {
  const v = w.customerView;
  if (!v) return null;
  const current = v.stages.find((s) => s.state === 'now') ?? null;
  const today = istDay(now);
  const todays = v.updates.find((u) => istDay(new Date(u.at)) === today) ?? null;
  /* Phase 2: today's post from site mode comes first. */
  const todaysLog = v.siteLogs.find((d) => d.day === today) ?? null;
  const siteLine = todaysLog
    ? todaysLog.kind === 'nobody'
      ? `Nobody on site: ${(todaysLog.reasonText ?? 'no reason').toLowerCase()}.`
      : `${todaysLog.photos.length} photo${todaysLog.photos.length === 1 ? '' : 's'}${todaysLog.photos[0]?.text ? `: ${todaysLog.photos[0].text}` : todaysLog.text ? `: ${todaysLog.text}` : ''} (${clock(new Date(todaysLog.postedAt))})`
    : null;
  const decision = v.decisions.find((d) => d.state !== 'chosen') ?? null;
  const next = v.money?.next ?? null;
  /* Customer milestones (docs/studio-os/CUSTOMER-MILESTONES.md): the stage under way and only its starred steps, as the app shows them. */
  const nowStage = v.tracker?.stages.find((s) => s.state === 'now') ?? null;
  const late = w.row.lateDays;
  const openSnags = v.snags.filter((s) => s.status === 'OPEN').length;
  return (
    <section className="oi-sees seescard" aria-label={`What ${w.customerFirst} sees right now`}>
      <span className="ttl">
        <LineIcon name="eye" size={15} />
        What {w.customerFirst} sees right now
      </span>
      <div className="flex flex-wrap gap-2">
        <span className="ipill" style={{ color: current?.late ? 'var(--inv-bad)' : 'var(--inv-good)' }}>
          {current ? `${current.label} · ${current.late ? 'running late' : 'on track'}` : 'Handed over'}
        </span>
        <span className="ipill" style={{ color: late > 0 ? 'var(--inv-bad)' : 'var(--inv-good)' }}>
          {late > 0 ? `Overall · ${late} day${late === 1 ? '' : 's'} late` : 'Overall · on time'}
        </span>
      </div>
      <div
        className="stg"
        role="img"
        aria-label={`${v.stages.filter((s) => s.state === 'done').length} of ${v.stages.length} stages done`}
        style={{ ['--n' as string]: v.stages.length }}
      >
        {v.stages.map((s, i) => (
          <span key={i} style={{ background: s.state === 'done' ? 'var(--fill2)' : s.state === 'now' ? 'var(--inv-acc2)' : 'var(--inv-4)' }} />
        ))}
      </div>
      {nowStage ? (
        <div className="sect">
          <span className="k">
            {nowStage.label} · {nowStage.progressPct}% · {nowStage.kind === 'DESIGN' && nowStage.steps.every((x) => x.plannedOn === null && x.doneOn === null) ? `${nowStage.steps.length} steps` : `★ ${nowStage.steps.length} milestone${nowStage.steps.length === 1 ? '' : 's'}`}
          </span>
          {nowStage.steps.length ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px]">
              {nowStage.steps.map((m, i) => (
                <li key={`${m.label}-${i}`} className="flex justify-between gap-3">
                  <span>
                    {m.done ? '✓ ' : ''}
                    {m.label}
                  </span>
                  <span className="mono oi-im whitespace-nowrap text-[12.5px]">
                    {m.done && m.doneOn ? `done ${iso(m.doneOn)}` : m.plannedOn ? iso(m.plannedOn) : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="oi-im text-[13px]">No starred step: they see the stage and its % only. Star 2 or 3 on the Plan tab.</span>
          )}
        </div>
      ) : null}
      <div className="sect">
        <span className="k">Today on site</span>
        <span className="v">{siteLine ?? (todays ? `${todays.note} (${clock(new Date(todays.at))})` : 'Nothing posted yet today.')}</span>
      </div>
      {decision ? (
        <div className="sect">
          <span className="k">Their decision, due {iso(decision.dueOn)}</span>
          <span className="v">{decision.title} · not picked yet</span>
        </div>
      ) : null}
      {next && w.contractPaise !== null ? (
        <div className="sect">
          <span className="k">Next payment</span>
          <span className="v mono">
            {formatINR(next.amountPaise)} · {next.label}
          </span>
        </div>
      ) : null}
      <span className="oi-im text-[12.5px]">
        {openSnags} open snag{openSnags === 1 ? '' : 's'} · {v.documents.length} document{v.documents.length === 1 ? '' : 's'} in the Locker ·{' '}
        {v.plan === 'assured' ? 'Assured' : 'Basic'}
      </span>
    </section>
  );
}

