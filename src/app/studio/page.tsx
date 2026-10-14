import Link from 'next/link';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { formatINR, formatINRCompact } from '@/lib/money';
import { redirect } from 'next/navigation';
import { crmIsOpen, standingOf, STANDING_COPY } from '@/modules/studio/standing';
import { myAnnouncements } from '@/modules/studio/announcements';
import { myInbox } from '@/modules/studio/inbox';
import { Inbox } from './Inbox';
import { myRatesGate, RATES_GATE_COPY } from '@/modules/studio-quote/rates-gate';
import { RatesGateCard } from './RatesGateCard';
import { StandingBanner } from './StandingBanner';
import { currentStudio, onboardingProgress, firstIncomplete } from '@/modules/studio/onboarding';
import { visibility } from '@/modules/studio/dashboard';
import { myAppointments, formatSlot, upcoming, KIND_LABELS } from '@/modules/studio/introduction';
import { dueSnapshot } from '@/modules/studio-sales/leads-list';
import { colourOf } from '@/modules/studio-practice/vocabulary';
import { myProjects, PROJECT_STAGE_LABELS } from '@/modules/studio-practice/projects';
import { LineIcon } from './ui/icons';
import './office-ui.css';
import './today/today.css';
import './overview.css';
import { myVendors } from '@/modules/studio-practice/vendors';
import { myQuotes } from '@/modules/studio-quote/quotes';
import { PUNE_LOCALITIES } from '@/modules/brief/types';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The studio's morning screen.
 *
 * ## What changed, and why
 *
 * This used to answer one question — is the marketplace sending me work — because
 * that was all the product did. It now answers the question a studio owner
 * actually opens software with: **what needs me today.**
 *
 * The order reflects that. People waiting on a call come first, because a
 * missed follow-up costs a job. Money owed to trades second, because it is the
 * thing that wakes people up. Meetings third. Briefs from us last — genuinely
 * last, because on most mornings for most studios it is the smallest number on
 * the page, and pretending otherwise would be us flattering ourselves on
 * somebody else's dashboard.
 */
export default async function StudioHome() {
  const context = await currentStudio();

  if (!context) {
    return (
      <main className="content ox-page">
        <div className="empty" style={{ maxWidth: '52ch' }}>
          <b>No studio on this account</b>
          <span className="muted sm">
            This sign-in is not linked to a studio yet. If you have just been approved and are seeing this, tell us — it is our mistake to fix, not yours.
          </span>
        </div>
      </main>
    );
  }

  const { studio } = context;

  /**
   * The software opens when they submit, not when we approve.
   *
   * It used to be `status !== 'ACTIVE'`, which parked a studio on a holding
   * screen for the week we spend calling their clients — at exactly the
   * moment they are most interested, and most likely to start a competitor's
   * trial instead. It also had the incentive backwards: the CRM is what makes
   * them want to stay, and withholding it until our paperwork is done means
   * the waiting week is spent somewhere else.
   *
   * What is still gated is anything that turns on being VERIFIED — the
   * roster, matching, briefs. Those are claims about a studio we have
   * checked, and `receivesBriefs()` is the one line that decides them. See
   * `modules/studio/standing.ts`.
   */
  if (!crmIsOpen({ status: studio.status, submittedForReview: studio.submittedForReview })) {
    return <Setup studio={studio} />;
  }

  /* Counted in SQL, with the first six due rows only (leads at scale:
     reading the board's 400 rows stopped every count at 400). */
  const [snap, projects, vendors, quotes, briefs, appointments] = await Promise.all([
    dueSnapshot(6),
    myProjects(),
    myVendors(),
    myQuotes(),
    visibility(studio.id),
    myAppointments(),
  ]);

  const dueCount = snap.due;
  const dueRows = snap.first;
  const owed = vendors.reduce((sum, v) => sum + Math.max(0, v.balancePaise), 0);
  const drafts = quotes.filter((q) => q.status === 'DRAFT');
  const next = upcoming(appointments).slice(0, 3);
  const liveProjects = projects.filter((p) => p.stage !== 'CLOSED');

  /**
   * Open clients nobody has spoken to in a week — or ever. A client with no
   * `nextActionOn` never appears on an overdue list no matter how long they
   * are ignored, so this is the number the follow-up date cannot give you.
   */
  const quietCount = snap.quiet;
  const poolCount = snap.pool;

  const quiet =
    dueCount === 0 &&
    owed === 0 &&
    drafts.length === 0 &&
    next.length === 0 &&
    quietCount === 0;
  /* Where they stand, and anything we have told them that they have not read.
     Both sit above the dashboard rather than inside it: a studio arriving to
     find out whether they were approved should not have to look for it. */
  const standing = standingOf({
    status: studio.status,
    submittedForReview: studio.submittedForReview,
  });
  const [announcements, ratesGate, inbox] = await Promise.all([myAnnouncements(), myRatesGate(), myInbox()]);
  const approval = announcements.find((a) => a.template === 'studio.approved') ?? null;

  const dueChip = (late: boolean, good: string, bad: string) =>
    late ? (
      <span className="chip bad">
        <span className="dot" />
        {bad}
      </span>
    ) : (
      <span className="chip good">
        <span className="dot" />
        {good}
      </span>
    );

  return (
    <main className="content ox-page">
      <StandingBanner
        standing={standing}
        label={STANDING_COPY[standing].label}
        detail={STANDING_COPY[standing].detail}
        approval={approval ? { id: approval.id } : null}
      />

      <div className="phead">
        <div>
          <span className="eyebrow">{studio.tradeName}</span>
          <h1>{quiet ? 'Nothing needs you right now.' : 'Your studio today'}</h1>
          <p className="muted" style={{ fontSize: 15 }}>
            {quiet ? 'No follow-ups due, nothing owed, no drafts open.' : 'Who is waiting, what is owed, what is running.'}
          </p>
        </div>
        <div className="hstack">
          {next.length > 0 ? (
            <Link href="/studio/calendar" className="btn sec">
              {next.length} meeting{next.length === 1 ? '' : 's'} coming up
            </Link>
          ) : null}
          <Link href="/studio/today" className="btn pri">
            Your list for today
          </Link>
        </div>
      </div>

      {/* Their rates, and whether the builder is open. Only once they have
          checked them is it out of the way — see rates-gate.ts. */}
      {ratesGate !== 'OPEN' ? <RatesGateCard gate={ratesGate} {...RATES_GATE_COPY[ratesGate]} where="elsewhere" /> : null}

      {/* ── The ones going quiet ──
          Deliberately a banner and not a fifth figure. It is not a number
          somebody checks every morning; it is a thing that goes wrong
          slowly and needs saying out loud when it does. */}
      {quietCount > 0 ? (
        <div className="ov-banner">
          <p style={{ margin: 0, maxWidth: '62ch' }}>
            <b className="mono">{quietCount}</b> {quietCount === 1 ? 'client has' : 'clients have'} had no contact for over a week
            {poolCount > 0 ? (
              <>
                , and <b className="mono">{poolCount}</b> {poolCount === 1 ? 'has' : 'have'} nobody working on them
              </>
            ) : null}
            . These never show up as overdue, because nobody set a date.
          </p>
          <Link href="/studio/clients?view=list&kind=open&sort=contacted" className="btn sec sm" style={{ marginLeft: 'auto' }}>
            Go through them
          </Link>
        </div>
      ) : null}

      <div className="cols">
        <div className="colmain">
          {/* ── Who is waiting ── */}
          <section className="card" aria-labelledby="h-wait" style={{ gap: 4 }}>
            <div className="chead" style={{ paddingBottom: 8 }}>
              <h2 id="h-wait">Waiting on you</h2>
              <Link href="/studio/clients" className="btn ghost sm">
                All clients
              </Link>
            </div>
            {dueCount === 0 ? (
              <p className="muted sm" style={{ margin: 0 }}>
                Nobody is overdue a call. A client with no follow-up date never appears here — setting one is what makes this list worth reading.
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {dueRows.map((c) => (
                  <li key={c.id} className="ov-row">
                    <span className="hstack" style={{ gap: 8 }}>
                      <b style={{ fontWeight: 600 }}>{c.name}</b>
                      {/* The studio's own column, in the studio's own colour. */}
                      <span className="chip" style={{ background: colourOf(c.stageColour).wash, color: colourOf(c.stageColour).ink }}>
                        {c.stageName}
                      </span>
                    </span>
                    <span className="muted sm">{c.nextAction}</span>
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="btn ghost sm ov-call">
                        <LineIcon name="phone" size={15} />
                        <span className="mono">{c.phone}</span>
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* New clients, signatures, customer choices — what came in since they last looked. */}
          <Inbox items={inbox} />
        </div>

        <div className="colside">
          {/* ── Four figures, and each one is a link to the thing it counts ── */}
          <section className="card" aria-labelledby="h-figs">
            <div className="chead">
              <h2 id="h-figs">At a glance</h2>
            </div>
            <div className="td-stats">
              <Stat href="/studio/clients?view=list&due=due&sort=followup" value={String(dueCount)} note={dueCount === 0 ? 'no follow-ups due' : 'clients due a call'} urgent={dueCount > 0} />
              <Stat href="/studio/vendors" value={owed > 0 ? formatINRCompact(owed) : '—'} note={owed > 0 ? 'owed to trades' : 'nothing owed to trades'} urgent={owed > 0} />
              <Stat href="/studio/projects" value={String(liveProjects.length)} note={liveProjects.length === 0 ? 'no live sites' : 'live sites'} />
              <Stat href="/studio/quotations" value={String(drafts.length)} note={drafts.length === 0 ? 'drafts: all sent' : 'draft quotations'} urgent={drafts.length > 0} />
            </div>
          </section>

          {/* ── Money out ── */}
          <section className="card" aria-labelledby="h-owed" style={{ gap: 6 }}>
            <div className="chead" style={{ paddingBottom: 6 }}>
              <h2 id="h-owed">Owed to trades</h2>
              <Link href="/studio/vendors" className="sm acc-t" style={{ fontWeight: 600 }}>
                The ledger
              </Link>
            </div>
            {owed === 0 ? (
              <p className="muted sm" style={{ margin: 0 }}>
                Nothing outstanding.
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {vendors
                  .filter((v) => v.balancePaise > 0)
                  .slice(0, 6)
                  .map((v) => (
                    <li key={v.id} className="ox-crow">
                      <span>
                        <b style={{ fontWeight: 600 }}>{v.name}</b> <span className="muted sm">· {v.trade}</span>
                      </span>
                      <b className="mono acc-t">{formatINR(v.balancePaise)}</b>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          {/* ── From the marketplace. Last, and honestly sized. ── */}
          <section className="intro" aria-labelledby="h-oi">
            <div className="hstack" style={{ justifyContent: 'space-between' }}>
              <span className="chip oi">
                <span className="dot" />
                From One Interiors
              </span>
              <Link href="/studio/calendar" className="sm" style={{ fontWeight: 600 }}>
                Calendar
              </Link>
            </div>
            <h2 id="h-oi" style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
              <span className="mono">{briefs.thisMonth}</span> brief{briefs.thisMonth === 1 ? '' : 's'} you appeared in
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              {briefs.thisMonth === 0 && briefs.lastMonth === 0
                ? 'This month, or last.'
                : briefs.lastMonth === 0
                  ? 'This month — your first.'
                  : briefs.thisMonth === briefs.lastMonth
                    ? 'This month, same as last.'
                    : briefs.thisMonth > briefs.lastMonth
                      ? `This month, up from ${briefs.lastMonth}.`
                      : `This month, down from ${briefs.lastMonth}.`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="muted sm">{next.length > 0 ? 'Next meeting' : 'Nothing booked'}</span>
              {next[0] ? (
                <>
                  <b style={{ fontSize: 15 }}>{formatSlot(next[0].startsAt)}</b>
                  <span className="muted sm">{[KIND_LABELS[next[0].kind], localityLabel(next[0].locality), next[0].customerName].filter(Boolean).join(' · ')}</span>
                </>
              ) : (
                <span className="muted sm">Meetings appear once a customer has chosen you on a call with our expert.</span>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── Live projects ── */}
      <section className="card flush" aria-labelledby="h-proj">
        <div className="chead">
          <h2 id="h-proj">Live projects</h2>
          <Link href="/studio/projects" className="btn ghost sm">
            All projects
            <LineIcon name="arrow" size={15} />
          </Link>
        </div>
        {liveProjects.length === 0 ? (
          <p className="muted sm" style={{ margin: 0, padding: '0 18px 18px' }}>
            Nothing running yet. A project appears here once a client signs with your studio.
          </p>
        ) : (
          <div className="tscroll">
            <table className="tbl" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th scope="col">Home</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Started</th>
                  <th scope="col">Overall</th>
                </tr>
              </thead>
              <tbody>
                {liveProjects.slice(0, 8).map((p) => {
                  const late = p.targetDate !== null && p.targetDate.getTime() < Date.now() && p.stage !== 'HANDOVER';
                  return (
                    <tr key={p.id}>
                      <td>
                        <b style={{ fontWeight: 600 }}>{p.name}</b> <span className="muted sm">· {p.clientName}</span>
                      </td>
                      <td>{PROJECT_STAGE_LABELS[p.stage]}</td>
                      <td className="mono sm">{p.startedOn ? p.startedOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                      <td>
                        {p.targetDate ? (
                          dueChip(late, `Due ${p.targetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, 'Past its date')
                        ) : (
                          <span className="muted">No date set</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ href, value, note, urgent = false }: { href: string; value: string; note: string; urgent?: boolean }) {
  return (
    <Link href={href} className={`stat${urgent ? ' hot' : ''}`}>
      <b className="mono">{value}</b>
      <span>{note}</span>
    </Link>
  );
}

function localityLabel(slug: string | null): string | null {
  if (!slug) return null;
  return PUNE_LOCALITIES.find((l) => l.slug === slug)?.label ?? slug;
}

/**
 * Setup mode: the checklist, and nothing else.
 *
 * A studio that has not been verified gets none of the practice software yet —
 * offering a vendor ledger to somebody whose profile is not finished buries the
 * five steps that are actually in their way.
 */
function Setup({
  studio,
}: {
  studio: NonNullable<Awaited<ReturnType<typeof currentStudio>>>['studio'];
}) {
  const { steps } = onboardingProgress(studio);

  /**
   * Not onboarding, and not active either — suspended or removed.
   *
   * This branch used to hold the "With us now" screen for a studio who had
   * submitted, along with a promise that the software would open "the day you
   * go live". Both are gone: a submitted studio now reaches the dashboard,
   * and the sentence became untrue the moment they did.
   *
   * What is left is the case nothing else covers. A suspended studio must not
   * be redirected into onboarding — there is no step for them to finish —
   * and must not be told anything that sounds like a decision, because a
   * suspension is investigated and appealable and this screen is not where
   * that is settled.
   */
  if (studio.status !== 'ONBOARDING') {
    return (
      <main className="py-14">
        <Container size="narrow">
          <p className="label m-0 mb-3">{studio.tradeName}</p>
          <h1 className="display mb-5 text-[clamp(2rem,5vw,3rem)] leading-[1.05]">
            Your account is paused.
          </h1>
          <p className="m-0 max-w-[54ch] text-[17px] leading-relaxed text-[var(--color-ink-2)]">
            Somebody here will have been in touch, or is about to be. If this is a surprise,
            write to{' '}
            <a
              href="mailto:studios@oneinteriors.in"
              className="text-[var(--color-petrol)] underline underline-offset-4"
            >
              studios@oneinteriors.in
            </a>{' '}
            and a person will answer — this is not decided by software.
          </p>
        </Container>
      </main>
    );
  }

  /**
   * Straight into the flow, rather than a screen about the flow.
   *
   * This used to be a checklist: a heading counting what was left, and the
   * unfinished steps as links. It was a second progress view competing with
   * the rail inside onboarding, and the two did not agree — this one counted
   * steps remaining while the rail counted steps done, and its one-line
   * summaries restated rules the step itself states more precisely. A studio
   * signing in had to read a page about the work before reaching the work.
   *
   * So there is nothing here now. An unfinished studio lands on whatever
   * step is genuinely next, which is the only thing this screen was ever
   * for. The rail that arrives with it lists all five, ticks what is done,
   * and is the single account of progress.
   *
   * `submittedForReview` above is kept, because that is a real and different
   * state rather than a duplicate of one: their side is finished, ours has
   * not, and there is no step to send them to.
   */
  redirect(`/studio/onboarding/${firstIncomplete(steps)}`);
}
