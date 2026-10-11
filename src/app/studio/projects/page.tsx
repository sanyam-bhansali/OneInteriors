import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead, PageBody } from '../StudioShell';
import { formatINR } from '@/lib/money';
import { studioProjects } from '@/modules/studio/workspace';
import { studioUpdateScore } from '@/modules/project/site-log';
import { ATTENTION_TITLES, clock, shortDay, type AttentionKind, type WorkspaceRow } from '@/modules/studio/workspace-view';

export const metadata: Metadata = {
  title: 'Projects',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The studio's live customer projects (studio workspace Phase 1, design
 * docs/studio-workspace/designs/studio/StudioProjects.dc.html), in the
 * studio's own deep-green palette.
 *
 * Every row is a customer's project (`HomeProject`) with a customer app
 * behind it: what the studio records shows there. Read-only in this phase;
 * site updates, decisions, snags and payments are still recorded on
 * /studio/updates until phase 2 replaces it.
 *
 * This replaced the feature-gated list of the studio's internal
 * `StudioProject`s that lived here (owner decision, 11 Oct 2026: everything
 * lives on the customer's project). That code is untouched in
 * studio-practice/projects.ts.
 */

const ACCENT: Record<AttentionKind, { bar: string; ink: string }> = {
  'no-update': { bar: 'var(--s-warn)', ink: 'var(--s-warn)' },
  'snag-overdue': { bar: 'var(--s-bad)', ink: 'var(--s-bad)' },
  payment: { bar: 'var(--s-accent)', ink: 'var(--s-accent)' },
  waiting: { bar: 'var(--s-ink-3)', ink: 'var(--s-ink-2)' },
};

const th = 'whitespace-nowrap px-3.5 py-3 text-left text-[12.5px] font-semibold text-[var(--s-ink-2)]';
const td = 'border-t border-[var(--s-rule)] px-3.5 py-3.5 align-top text-[14px]';
const sub = 'mt-0.5 text-[12.5px] text-[var(--s-ink-3)]';

export default async function ProjectsPage() {
  const now = new Date();
  const [data, score] = await Promise.all([studioProjects(now), studioUpdateScore(now)]); // score: Phase 2
  const rows = data?.rows ?? [];
  const live = rows.filter((r) => r.stage !== null);
  const own = new Set(data?.ownClientIds ?? []);
  /* Owner or PM: one obvious way to start a project for a client of their own (OWN-CLIENTS.md). */
  const startButton = data?.canStart ? (
    <Link
      href="/studio/projects/start"
      className="rounded-[8px] bg-[var(--s-accent)] px-4 py-2 text-[14px] font-medium text-white no-underline hover:bg-[var(--s-accent-deep)]"
    >
      Start a project
    </Link>
  ) : null;

  return (
    <>
      <PageHead
        title="Projects"
        sub={`${shortDay(now)} · ${live.length === 0 ? 'Nothing running yet.' : `${live.length} live`}${score && score.pct !== null ? ` · Daily site updates: ${score.pct}% of working days, last 30 days${score.streakMissed >= 2 ? ` · ${score.streakMissed} days in a row missed on a site` : ''}` : ''}`}
        action={startButton}
      />
      <PageBody>
        {rows.length === 0 ? (
          <div className="s-card p-8">
            <p className="m-0 mb-2 text-[15.5px] font-semibold">A project starts when a customer signs your final quote.</p>
            <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--s-ink-2)]">
              Signing builds the plan from the quote — the stages, each room&rsquo;s checklist, the payment stages and the
              materials — and the customer follows it in their app. Projects you are on appear here.
            </p>
            {startButton ? (
              <p className="m-0 mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--s-ink-2)]">
                A client of your own has accepted your quotation? Start their project from it, and invite them to follow it in the app.{' '}
                <Link href="/studio/projects/start" className="font-medium text-[var(--s-accent)]">
                  Start a project
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            <section aria-labelledby="h-attn" className="flex flex-col gap-3">
              <h2 id="h-attn" className="m-0 text-[16px] font-semibold">
                Needs attention today
              </h2>
              {data!.attention.length === 0 ? (
                <p className="m-0 text-[14px] text-[var(--s-ink-2)]">Nothing. Every live site has posted today and nothing is overdue.</p>
              ) : (
                <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 p-0">
                  {data!.attention.map((a, i) => (
                    <li key={`${a.kind}-${a.projectId}-${i}`}>
                      <Link
                        href={`/studio/projects/${a.projectId}`}
                        className="s-card flex h-full flex-col gap-1.5 p-4 no-underline"
                        style={{ boxShadow: `inset 4px 0 0 ${ACCENT[a.kind].bar}, var(--s-lift)` }}
                      >
                        <span className="text-[12.5px] font-semibold" style={{ color: ACCENT[a.kind].ink }}>
                          {ATTENTION_TITLES[a.kind]}
                        </span>
                        <span className="text-[15px] font-semibold text-[var(--s-ink)]">{a.home}</span>
                        <span className="text-[13.5px] leading-snug text-[var(--s-ink-2)]">{a.text}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="h-live" className="s-card">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-2">
                <h2 id="h-live" className="m-0 text-[16px] font-semibold">
                  Projects <span className="s-num font-[family-name:var(--font-mono)] text-[13px] font-normal text-[var(--s-ink-3)]">{rows.length}</span>
                </h2>
                <span className="text-[12.5px] text-[var(--s-ink-3)]">
                  Each row has a customer app behind it. What your team records in a project shows there.
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse">
                  <thead>
                    <tr>
                      <th scope="col" className={th}>Home and customer</th>
                      <th scope="col" className={th}>Stage</th>
                      <th scope="col" className={th}>Today on site</th>
                      <th scope="col" className={th}>Overall</th>
                      <th scope="col" className={th}>Snags</th>
                      <th scope="col" className={th}>Waiting on customer</th>
                      {data!.seesMoney ? <th scope="col" className={th}>Next payment</th> : null}
                      <th scope="col" className={th}>Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <Row key={r.id} r={r} money={data!.seesMoney} own={own.has(r.id)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </PageBody>
    </>
  );
}

function Row({ r, money, own }: { r: WorkspaceRow; money: boolean; own: boolean }) {
  const handedOver = r.stage === null;
  return (
    <tr>
      <td className={td}>
        <Link href={`/studio/projects/${r.id}`} className="font-semibold text-[var(--s-ink)] no-underline hover:text-[var(--s-accent)]">
          {r.home}
        </Link>
        <div className={sub}>
          {r.customer}
          {own ? <span className="s-tag ml-2 align-middle">Your own client</span> : null}
        </div>
      </td>
      <td className={td}>
        {r.stage ? (
          <>
            {r.stage.label}
            <div className={`${sub} s-num font-[family-name:var(--font-mono)]`}>
              day {r.stage.day} of {r.stage.of}
            </div>
          </>
        ) : (
          'Handed over'
        )}
      </td>
      <td className={td}>
        {handedOver ? (
          <span className="text-[var(--s-ink-3)]">—</span>
        ) : !r.started ? (
          'Not started'
        ) : r.postedToday ? (
          <span className="font-medium text-[var(--s-good)]">Posted {clock(r.postedToday)}</span>
        ) : (
          <span className="font-medium text-[var(--s-warn)]">Not posted yet</span>
        )}
      </td>
      <td className={td}>
        {r.lateDays > 0 ? (
          <span className="font-medium text-[var(--s-bad)]">
            {r.lateDays} day{r.lateDays === 1 ? '' : 's'} late
            {r.customerLateDays > 0 ? (
              <span className="block text-[12px] font-normal text-[var(--s-ink-3)]">
                {r.customerLateDays === r.lateDays ? 'all' : r.customerLateDays} from {r.customer}, not yours
              </span>
            ) : null}
          </span>
        ) : (
          <span className="font-medium text-[var(--s-good)]">{handedOver ? 'Done' : 'On track'}</span>
        )}
      </td>
      <td className={td}>
        {r.snags.open === 0 ? (
          'None'
        ) : (
          <>
            {r.snags.open} open
            {r.snags.overdue.length ? <div className="mt-0.5 text-[12.5px] font-medium text-[var(--s-bad)]">{r.snags.overdue.length} overdue</div> : null}
          </>
        )}
      </td>
      <td className={td}>
        {r.waiting.length === 0 ? (
          'None'
        ) : (
          <>
            {r.waiting[0]!.title}
            <div className={sub}>
              due {shortDay(r.waiting[0]!.dueOn)}
              {r.waiting.length > 1 ? ` · ${r.waiting.length - 1} more` : ''}
            </div>
          </>
        )}
      </td>
      {money ? (
        <td className={td}>
          {r.nextPayment ? (
            <>
              <span className="s-num font-[family-name:var(--font-mono)]">{formatINR(r.nextPayment.amountPaise)}</span>
              <div className={sub} style={r.nextPayment.toRecord ? { color: 'var(--s-accent)', fontWeight: 600 } : undefined}>
                {r.nextPayment.label}
                {r.nextPayment.toRecord ? ' · due, record it' : r.nextPayment.dueOn ? ` · ${shortDay(new Date(`${r.nextPayment.dueOn}T12:00:00Z`))}` : ''}
              </div>
            </>
          ) : (
            <span className="text-[var(--s-ink-3)]">—</span>
          )}
        </td>
      ) : null}
      <td className={td}>{r.plan === 'assured' ? 'Assured' : 'Basic'}</td>
    </tr>
  );
}
