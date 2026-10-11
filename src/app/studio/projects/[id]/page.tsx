import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageBody } from '../../StudioShell';
import { formatINR } from '@/lib/money';
import { projectWorkspace, TEAM_NOTES_MAX, type ProjectWorkspace, type WorkspaceStage } from '@/modules/studio/workspace';
import { clock, istDay, shortDay } from '@/modules/studio/workspace-view';
import { CustomerSees, OnlyYourTeam } from '../marks';
import { TeamNotes } from './TeamNotes';

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
  { key: 'log', label: 'Site log' },
  { key: 'snags', label: 'Snags' },
  { key: 'payments', label: 'Payments' },
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
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
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
  const tabs = TABS.filter((t) => t.key !== 'payments' || money);
  const tab: Tab = tabs.some((t) => t.key === rawTab) ? (rawTab as Tab) : 'plan';
  const counts: Record<Tab, number | null> = {
    plan: w.stages.length,
    log: w.updates.length,
    snags: w.work?.snags.filter((s) => s.status === 'OPEN').length ?? 0,
    payments: w.work?.money?.stages.length ?? null,
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
            {w.appConnected ? 'Customer app connected' : 'Customer app not on a phone yet'}
          </span>
        </div>
      </div>

      <PageBody>
        <div role="tablist" aria-label="Project sections" className="mb-5 flex flex-wrap gap-1.5 border-b border-[var(--s-rule)]">
          {tabs.map((t) => (
            <Link
              key={t.key}
              role="tab"
              aria-selected={t.key === tab}
              href={`/studio/projects/${w.id}${t.key === 'plan' ? '' : `?tab=${t.key}`}`}
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
            {tab === 'plan' ? <PlanTab w={w} /> : null}
            {tab === 'log' ? <LogTab w={w} now={now} /> : null}
            {tab === 'snags' ? <SnagsTab w={w} /> : null}
            {tab === 'payments' ? <PaymentsTab w={w} /> : null}
          </div>
          <aside className="flex flex-col gap-4" aria-label={`What ${w.customerFirst} sees`}>
            <CustomerPanel w={w} now={now} />
            <Locker w={w} />
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

function PlanTab({ w }: { w: ProjectWorkspace }) {
  return (
    <section aria-label="Plan" className="s-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={h2}>Plan</h2>
        <CustomerSees name={w.customerFirst} />
      </div>
      <p className={`m-0 mt-1 ${muted}`}>
        {w.hasPlan
          ? `Made from the signed quote: ${w.materials} material${w.materials === 1 ? '' : 's'} listed. Stages move when the site ticks items off.`
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

function LogTab({ w, now }: { w: ProjectWorkspace; now: Date }) {
  const today = istDay(now);
  const postedToday = w.updates.some((u) => istDay(u.at) === today);
  return (
    <section aria-label="Site log" className="s-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={h2}>Site log</h2>
        <CustomerSees name={w.customerFirst} />
      </div>
      <p className={`m-0 mt-1 ${muted}`}>
        Every update reaches {w.customerFirst}&rsquo;s app. Post from{' '}
        <Link href="/studio/updates" className="text-[var(--s-accent)]">
          Client projects
        </Link>{' '}
        for now.
      </p>
      <ul className="m-0 mt-4 flex list-none flex-col p-0">
        {!postedToday && w.row.stage ? (
          <li className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-t border-[var(--s-rule)] py-3 text-[14px]">
            <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--s-ink-3)]">{shortDay(now)}</span>
            <span className="font-medium text-[var(--s-warn)]">Not posted yet today.</span>
          </li>
        ) : null}
        {w.updates.map((u) => (
          <li key={u.id} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-t border-[var(--s-rule)] py-3 text-[14px]">
            <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--s-ink-3)]">{shortDay(u.at)}</span>
            <span>
              {u.note}
              <span className={`block ${muted}`}>
                {clock(u.at)}
                {u.photos ? ` · ${u.photos} photo${u.photos === 1 ? '' : 's'}` : ''}
                {u.byStudio ? '' : ' · from One Interiors'}
              </span>
            </span>
          </li>
        ))}
        {w.updates.length === 0 ? <li className={`border-t border-[var(--s-rule)] py-3 ${muted}`}>Nothing posted yet.</li> : null}
      </ul>
    </section>
  );
}

function SnagsTab({ w }: { w: ProjectWorkspace }) {
  const snags = w.work?.snags ?? [];
  return (
    <section aria-label="Snags" className="s-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={h2}>Snags</h2>
        <CustomerSees name={w.customerFirst} />
      </div>
      <p className={`m-0 mt-1 ${muted}`}>
        Set fix-by dates and close snags from{' '}
        <Link href="/studio/updates" className="text-[var(--s-accent)]">
          Client projects
        </Link>{' '}
        for now.
      </p>
      <ul className="m-0 mt-4 flex list-none flex-col p-0">
        {snags.map((s) => (
          <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-[var(--s-rule)] py-3 text-[14px]">
            <span>
              <span className="font-medium">{s.title}</span>
              <span className={`block ${muted}`}>
                {[s.room, `raised by ${s.raisedByStudio ? 'your team' : w.customerFirst}, ${iso(s.raisedAt)}`].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="text-right text-[13px]">
              {s.status === 'FIXED' ? (
                <span className="text-[var(--s-good)]">Fixed</span>
              ) : (
                <>
                  <span className="font-medium">Open</span>
                  <span className={`block ${muted}`}>{s.fixBy ? `fix by ${iso(`${s.fixBy}T12:00:00Z`)}` : 'no fix-by date'}</span>
                </>
              )}
            </span>
          </li>
        ))}
        {snags.length === 0 ? <li className={`border-t border-[var(--s-rule)] py-3 ${muted}`}>No snags.</li> : null}
      </ul>
    </section>
  );
}

function PaymentsTab({ w }: { w: ProjectWorkspace }) {
  const m = w.work?.money ?? null;
  return (
    <section aria-label="Payments" className="s-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={h2}>
          Payments{' '}
          {m ? (
            <span className="s-num font-[family-name:var(--font-mono)] text-[13px] font-normal text-[var(--s-ink-3)]">
              {formatINR(m.paidPaise)} of {formatINR(m.contractPaise)} received
            </span>
          ) : null}
        </h2>
        <CustomerSees name={w.customerFirst} />
      </div>
      <p className={`m-0 mt-1 ${muted}`}>
        {w.customerFirst} pays you directly; this is the record of it, as signed. Mark a payment received from{' '}
        <Link href="/studio/updates" className="text-[var(--s-accent)]">
          Client projects
        </Link>{' '}
        for now.
      </p>
      {m ? (
        <ul className="m-0 mt-4 flex list-none flex-col p-0">
          {m.stages.map((s) => (
            <li key={s.index} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-t border-[var(--s-rule)] py-3 text-[14px]">
              <span>
                {s.label}
                {s.pct !== null ? <span className={`block ${muted}`}>{s.pct}%</span> : null}
              </span>
              <span className="s-num font-[family-name:var(--font-mono)]">{formatINR(s.amountPaise)}</span>
              <span className="text-right text-[13px]">
                {s.paidOn ? (
                  <span className="text-[var(--s-good)]">Received {iso(`${s.paidOn}T12:00:00Z`)}</span>
                ) : s.dueOn ? (
                  `Due ${iso(`${s.dueOn}T12:00:00Z`)}`
                ) : (
                  <span className="text-[var(--s-ink-3)]">No date set</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`m-0 mt-4 ${muted}`}>This project was started before signing in the app, so it has no signed payment plan.</p>
      )}
    </section>
  );
}

/** The dark panel: the customer projection, as the app shows it now. */
function CustomerPanel({ w, now }: { w: ProjectWorkspace; now: Date }) {
  const v = w.customerView;
  const ink2 = 'rgba(255,255,255,0.72)';
  const label = 'm-0 text-[11.5px] font-semibold uppercase tracking-[0.06em]';
  if (!v) return null;
  const current = v.stages.find((s) => s.state === 'now') ?? null;
  const today = istDay(now);
  const todays = v.updates.find((u) => istDay(new Date(u.at)) === today) ?? null;
  const decision = v.decisions.find((d) => d.state !== 'chosen') ?? null;
  const next = v.money?.next ?? null;
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
      <div className="flex flex-col gap-1">
        <p className={label} style={{ color: ink2 }}>
          Today on site
        </p>
        <span className="text-[13.5px] leading-snug">{todays ? `${todays.note} (${clock(new Date(todays.at))})` : 'Nothing posted yet today.'}</span>
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

function Locker({ w }: { w: ProjectWorkspace }) {
  const docs = w.customerView?.documents ?? [];
  const drafts = (w.work?.documents ?? []).filter((d) => !d.shared).length;
  return (
    <section className="s-card flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[15px] font-semibold">Home locker</h2>
        <CustomerSees name={w.customerFirst} />
      </div>
      {docs.length ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {docs.map((d) => (
            <li key={d.id} className="text-[13.5px]">
              {d.title} <span className={muted}>· {d.meta}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`m-0 ${muted}`}>Nothing shared yet.</p>
      )}
      <p className={`m-0 ${muted}`}>
        {w.hasPlan ? `${w.materials} material${w.materials === 1 ? '' : 's'} from the quote. ` : ''}
        {drafts ? `${drafts} draft${drafts === 1 ? '' : 's'} only your team can see.` : ''}
      </p>
    </section>
  );
}
