import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageBody } from '../../StudioShell';
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
import { InviteBanner } from './InviteBanner';
/* Studio OS Phase 2: the design phase (modules/studio-design). */
import { DesignTab as DesignSection } from './DesignTab';
import { currentMember } from '@/modules/studio/access';
/* Studio OS Phase 3: the site crews' work orders (modules/studio-crews). */
import { CrewsTab as CrewsSection } from './CrewsTab';
import { can as roleCan } from '@/modules/studio/roles';

export const metadata: Metadata = { title: 'Project', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * One customer project, from the studio's office (studio workspace Phase 1,
 * design docs/studio-workspace/designs/studio/StudioProject.dc.html), in the
 * studio's deep-green palette.
 *
 * - Plan: the stages built from the signed quote and each room's checklist.
 *   Read-only in this phase.
 * - Site log, Snags, Payments: read-only here; posting, fixing and marking
 *   received still happen on /studio/updates until phase 2.
 * - The dark panel is the customer projection itself
 *   (portal/customer-project.ts), so it shows what the app shows.
 *
 * Everything the customer sees carries a "sees this" marker; the team's own
 * notes sit in the grey "Only your team" box.
 */

const TABS = [
  { key: 'plan', label: 'Plan' },
  { key: 'design', label: 'Design' },
  { key: 'log', label: 'Site log' },
  { key: 'snags', label: 'Snags' },
  { key: 'payments', label: 'Payments' },
  { key: 'crews', label: 'Crews' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const chip = 'inline-flex items-center rounded-full border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-1 text-[13px] text-[var(--s-ink-2)]';
const h2 = 'm-0 text-[16px] font-semibold';
const muted = 'text-[12.5px] text-[var(--s-ink-3)]';
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
      <PageBody>
        <p className="m-0 text-[15px] text-[var(--s-ink-2)]">{r.error}</p>
      </PageBody>
    );
  }
  const w = r.workspace;
  const money = w.contractPaise !== null;
  const viewer = await currentMember();
  // Studio OS Phase 3: Crews for those who see work orders (owner, PM, accounts), never a designer.
  const crews = viewer === null || roleCan(viewer, 'workorder.read', { assigned: true });
  const tabs = TABS.filter((t) => (t.key !== 'payments' || money) && (t.key !== 'crews' || crews));
  // A designer (Studio OS Phase 2) opens on the Design tab.
  const fallback: Tab = viewer?.role === 'DESIGNER' ? 'design' : 'plan';
  const tab: Tab = tabs.some((t) => t.key === rawTab) ? (rawTab as Tab) : fallback;
  const counts: Record<Tab, number | null> = {
    plan: w.stages.length,
    design: null,
    log: null, // Phase 2: the Site log tab counts its own days
    snags: w.work?.snags.filter((s) => s.status === 'OPEN').length ?? 0,
    payments: w.work?.money?.stages.length ?? null,
    crews: null,
  };

  return (
    <>
      <div className="border-b border-[var(--s-rule)] bg-[var(--s-rail)]/50 px-5 py-4 sm:px-7">
        <Link href="/studio/projects" className="text-[13px] text-[var(--s-ink-3)] no-underline hover:text-[var(--s-accent)]">
          ← Projects
        </Link>
        <h1 className="m-0 mt-1 text-[22px] font-semibold tracking-tight">{w.home}</h1>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <span className={chip}>{w.customer}</span>
          {w.ownClient ? (
            <span className={chip} title="Not introduced by One Interiors: no introduction, no commission">
              Your own client
            </span>
          ) : null}
          {w.bhk || w.tier ? <span className={chip}>{[w.bhk, w.tier].filter(Boolean).join(' · ')}</span> : null}
          {money ? (
            <span className={`${chip} s-num font-[family-name:var(--font-mono)]`}>
              {formatINR(w.contractPaise!)}
              {w.signedAt ? ` · signed ${shortDay(w.signedAt)}` : ''}
            </span>
          ) : null}
          <span className={chip}>{w.plan === 'assured' ? 'Assured' : w.assuredRequested ? 'Basic · asked for Assured' : 'Basic'}</span>
          <span
            className={chip}
            style={w.appConnected ? { borderColor: 'var(--s-accent)', color: 'var(--s-accent)', background: 'var(--s-accent-wash)' } : undefined}
          >
            {w.appConnected
              ? 'Customer app connected'
              : w.ownClient && !w.customerJoined
                ? 'Invited, not joined yet'
                : w.customerJoined
                  ? 'Customer signed in, app not on a phone yet'
                  : 'Customer app not on a phone yet'}
          </span>
        </div>
      </div>

      <PageBody>
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
        <div role="tablist" aria-label="Project sections" className="mb-5 flex flex-wrap gap-1.5 border-b border-[var(--s-rule)]">
          {tabs.map((t) => (
            <Link
              key={t.key}
              role="tab"
              aria-selected={t.key === tab}
              href={`/studio/projects/${w.id}?tab=${t.key}`}
              className={`-mb-px border-b-2 px-3 py-2 text-[14px] no-underline ${
                t.key === tab ? 'border-[var(--s-accent)] font-semibold text-[var(--s-ink)]' : 'border-transparent text-[var(--s-ink-2)] hover:text-[var(--s-ink)]'
              }`}
            >
              {t.label}
              {counts[t.key] !== null ? <span className="ml-1.5 font-[family-name:var(--font-mono)] text-[12px] text-[var(--s-ink-3)]">{counts[t.key]}</span> : null}
            </Link>
          ))}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            {tab === 'plan' ? <PlanSection w={w} now={now} /> : null}
            {tab === 'design' ? <DesignSection projectId={w.id} now={now} /> : null}
            {/* Phase 2: the daily site log (SiteLogTab.tsx), with the old notes under it. */}
            {tab === 'log' ? <SiteLogTab projectId={w.id} customer={w.customerFirst} now={now} legacy={w.updates} /> : null}
            {tab === 'snags' ? <SnagsPanel projectId={w.id} now={now} /> : null}
            {tab === 'payments' ? <PaymentsPanel projectId={w.id} customer={w.customerFirst} /> : null}
            {tab === 'crews' ? <CrewsSection projectId={w.id} now={now} /> : null}
          </div>
          <aside className="flex flex-col gap-4" aria-label={`What ${w.customerFirst} sees`}>
            <CustomerPanel w={w} now={now} />
            <DecisionsCard projectId={w.id} customer={w.customerFirst} />
            <LockerCard projectId={w.id} customer={w.customerFirst} />
            <OnlyYourTeam>
              <TeamNotes projectId={w.id} initial={w.teamNotes} canEdit={w.canEditNotes} max={TEAM_NOTES_MAX} />
            </OnlyYourTeam>
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function stateLine(s: WorkspaceStage): { text: string; tone: string } {
  if (s.state === 'done') return { text: 'Done', tone: 'var(--s-good)' };
  if (s.late) return { text: `Late · was due ${shortDay(s.targetOn)}`, tone: 'var(--s-bad)' };
  if (s.state === 'now') return { text: 'Now · on track', tone: 'var(--s-accent)' };
  return { text: s.state === 'next' ? 'Next' : 'Later', tone: 'var(--s-ink-3)' };
}

/** Phase 3: the editable plan when it was built from the quote; the read-only standard stages otherwise. */
async function PlanSection({ w, now }: { w: ProjectWorkspace; now: Date }) {
  const r = w.hasPlan ? await planForStudio(w.id, now) : null;
  if (r?.ok && r.plan) return <PlanEditor plan={r.plan} customer={w.customerFirst} />;
  return <PlanTab w={w} />;
}

function PlanTab({ w }: { w: ProjectWorkspace }) {
  return (
    <section aria-label="Plan" className="s-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={h2}>Plan</h2>
        {/* The client sees the stages and only the starred steps; the rest stays with the team. */}
        <span className="text-[11.5px] font-medium text-[var(--s-accent)]">{w.customerFirst} sees the stages and ★ steps only</span>
      </div>
      <p className={`m-0 mt-1 ${muted}`}>
        {w.hasPlan
          ? `Made from the signed quote: ${w.materials} material${w.materials === 1 ? '' : 's'} listed. A stage finishes when the site ticks its last step, with a photo.`
          : 'Signed before plans were built from the quote, so this shows the standard stages. Its plan is built once the backfill runs.'}
      </p>
      <ol className="m-0 mt-4 flex list-none flex-col gap-0 p-0">
        {w.stages.map((s, i) => {
          const st = stateLine(s);
          return (
            <li key={`${s.key}-${i}`} className="border-t border-[var(--s-rule)] py-3.5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_120px_190px]">
                <span className="text-[15px] font-semibold">{s.label}</span>
                <span className="s-num font-[family-name:var(--font-mono)] text-[13px] text-[var(--s-ink-2)]">{shortDay(s.targetOn)}</span>
                <span className="text-[13px] font-medium" style={{ color: st.tone }}>
                  {st.text}
                </span>
              </div>
              {s.rooms.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {s.rooms.map((room) => (
                    <div key={room.room} className="rounded-[10px] bg-[var(--s-surface-2)] p-3">
                      <p className="m-0 mb-1.5 text-[12.5px] font-semibold text-[var(--s-ink-2)]">{room.room}</p>
                      <ul className="m-0 flex list-none flex-col gap-1 p-0">
                        {room.items.map((it, k) => (
                          <li key={k} className="flex items-start gap-2 text-[13.5px]">
                            <span
                              aria-hidden="true"
                              className="mt-[3px] inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[4px] border text-[10px]"
                              style={it.done ? { background: 'var(--s-accent)', borderColor: 'var(--s-accent)', color: '#fff' } : { borderColor: 'var(--s-ink-3)' }}
                            >
                              {it.done ? '✓' : ''}
                            </span>
                            <span className={it.done ? 'text-[var(--s-ink-3)]' : undefined}>
                              {it.label}
                              <span className="sr-only">{it.done ? ' (done)' : ' (open)'}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
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
  const ink2 = 'rgba(255,255,255,0.72)';
  const label = 'm-0 text-[11.5px] font-semibold uppercase tracking-[0.06em]';
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
  return (
    <section className="flex flex-col gap-4 rounded-[14px] p-5 text-white" style={{ background: 'var(--s-accent-deep)' }}>
      <p className="m-0 inline-flex items-center gap-1.5 text-[13.5px] font-semibold">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        What {w.customerFirst} sees right now
      </p>
      <div className="flex flex-col gap-0.5">
        <span className="text-[17px] font-semibold">{current ? `${current.label} · ${current.late ? 'running late' : 'on track'}` : 'Handed over'}</span>
        {w.row.lateDays > 0 ? <span style={{ color: ink2 }} className="text-[13.5px]">Overall · {w.row.lateDays} day{w.row.lateDays === 1 ? '' : 's'} late</span> : null}
      </div>
      <div role="img" aria-label={`${v.stages.filter((s) => s.state === 'done').length} of ${v.stages.length} stages done`} className="flex gap-1">
        {v.stages.map((s, i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: s.state === 'done' ? '#fff' : s.state === 'now' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)' }}
          />
        ))}
      </div>
      {nowStage ? (
        <div className="flex flex-col gap-1">
          <p className={label} style={{ color: ink2 }}>
            {nowStage.label} · {nowStage.progressPct}% · ★ {nowStage.steps.length} milestone{nowStage.steps.length === 1 ? '' : 's'}
          </p>
          {nowStage.steps.length ? (
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[13.5px]">
              {nowStage.steps.map((m, i) => (
                <li key={`${m.label}-${i}`} className="flex justify-between gap-3">
                  <span>
                    {m.done ? '✓ ' : ''}
                    {m.label}
                  </span>
                  <span className="s-num whitespace-nowrap font-[family-name:var(--font-mono)] text-[12.5px]" style={{ color: ink2 }}>
                    {m.done && m.doneOn ? `done ${iso(m.doneOn)}` : m.plannedOn ? iso(m.plannedOn) : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-[13px]" style={{ color: ink2 }}>
              No starred step: they see the stage and its % only. Star 2 or 3 on the Plan tab.
            </span>
          )}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className={label} style={{ color: ink2 }}>
          Today on site
        </p>
        <span className="text-[13.5px] leading-snug">{siteLine ?? (todays ? `${todays.note} (${clock(new Date(todays.at))})` : 'Nothing posted yet today.')}</span>
      </div>
      {decision ? (
        <div className="flex flex-col gap-1">
          <p className={label} style={{ color: ink2 }}>
            Their decision, due {iso(decision.dueOn)}
          </p>
          <span className="text-[13.5px]">{decision.title} · not picked yet</span>
        </div>
      ) : null}
      {next && w.contractPaise !== null ? (
        <div className="flex flex-col gap-1">
          <p className={label} style={{ color: ink2 }}>
            Next payment
          </p>
          <span className="s-num font-[family-name:var(--font-mono)] text-[13.5px]">
            {formatINR(next.amountPaise)} · {next.label}
          </span>
        </div>
      ) : null}
      <span className="text-[12px]" style={{ color: ink2 }}>
        {v.snags.filter((s) => s.status === 'OPEN').length} open snag{v.snags.filter((s) => s.status === 'OPEN').length === 1 ? '' : 's'} ·{' '}
        {v.documents.length} document{v.documents.length === 1 ? '' : 's'} in the Locker · {v.plan === 'assured' ? 'Assured' : 'Basic'}
      </span>
    </section>
  );
}
