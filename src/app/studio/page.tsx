import Link from 'next/link';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { PageHead, PageBody } from './StudioShell';
import { formatINR, formatINRCompact } from '@/lib/money';
import { currentStudio, onboardingProgress, STEP_LABELS } from '@/modules/studio/onboarding';
import { visibility } from '@/modules/studio/dashboard';
import { myAppointments, formatSlot, upcoming, KIND_LABELS } from '@/modules/studio/introduction';
import { myClients, BOARD_KINDS } from '@/modules/studio-practice/clients';
import { colourOf, QUIET_AFTER_DAYS } from '@/modules/studio-practice/vocabulary';
import { myProjects } from '@/modules/studio-practice/projects';
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
      <PageBody>
        <div className="s-card max-w-[52ch] p-6">
          <h1 className="m-0 mb-3 text-[19px] font-semibold">No studio on this account</h1>
          <p className="m-0 text-[14.5px] leading-relaxed text-[var(--s-ink-2)]">
            This sign-in is not linked to a studio yet. If you have just been approved and are
            seeing this, tell us — it is our mistake to fix, not yours.
          </p>
        </div>
      </PageBody>
    );
  }

  const { studio } = context;
  if (studio.status !== 'ACTIVE') return <Setup studio={studio} />;

  const [clients, projects, vendors, quotes, briefs, appointments] = await Promise.all([
    myClients(),
    myProjects(),
    myVendors(),
    myQuotes(),
    visibility(studio.id),
    myAppointments(),
  ]);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const due = clients.filter(
    (c) => BOARD_KINDS.includes(c.stageKind) && c.nextActionOn !== null && c.nextActionOn <= today,
  );
  const owed = vendors.reduce((sum, v) => sum + Math.max(0, v.balancePaise), 0);
  const drafts = quotes.filter((q) => q.status === 'DRAFT');
  const next = upcoming(appointments).slice(0, 3);
  const liveProjects = projects.filter((p) => p.stage !== 'CLOSED');

  /**
   * Open clients nobody has spoken to in a week — or ever.
   *
   * This is the number the follow-up date cannot give you. A client with no
   * `nextActionOn` never appears on an overdue list no matter how long they
   * are ignored, so the busiest-looking board can be one where nothing is
   * moving. An imported list starts here in its entirety, which is the point:
   * two hundred rows that nobody has begun are exactly what a studio needs
   * shown back to them on day two.
   */
  const open = clients.filter((c) => BOARD_KINDS.includes(c.stageKind));
  const quietLine = Date.now() - QUIET_AFTER_DAYS * 86_400_000;
  const quietClients = open.filter(
    (c) => c.lastContactedAt === null || c.lastContactedAt.getTime() < quietLine,
  );
  const pool = open.filter((c) => c.assignedToId === null);

  const quiet =
    due.length === 0 &&
    owed === 0 &&
    drafts.length === 0 &&
    next.length === 0 &&
    quietClients.length === 0;

  return (
    <>
      <PageHead
        title={quiet ? 'Nothing needs you right now.' : 'Today'}
        sub={
          quiet
            ? 'No follow-ups due, nothing owed, no drafts open.'
            : `${studio.tradeName}`
        }
      />

      <PageBody>
        <div className="flex flex-col gap-6">
          {/* ── Four figures, and each one is a link to the thing it counts ── */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              href="/studio/clients"
              label="Waiting on you"
              value={String(due.length)}
              note={due.length === 0 ? 'No follow-ups due' : 'clients due a call'}
              urgent={due.length > 0}
            />
            <Stat
              href="/studio/vendors"
              label="Owed to trades"
              value={owed > 0 ? formatINRCompact(owed) : '—'}
              note={owed > 0 ? 'across open work orders' : 'nothing outstanding'}
              urgent={owed > 0}
            />
            <Stat
              href="/studio/projects"
              label="Live sites"
              value={String(liveProjects.length)}
              note={liveProjects.length === 0 ? 'nothing running' : 'in progress'}
            />
            <Stat
              href="/studio/quotations"
              label="Draft quotations"
              value={String(drafts.length)}
              note={drafts.length === 0 ? 'all sent' : 'not sent yet'}
              urgent={drafts.length > 0}
            />
          </div>

          {/* ── The ones going quiet ──
              Deliberately a banner and not a fifth figure. It is not a number
              somebody checks every morning; it is a thing that goes wrong
              slowly and needs saying out loud when it does. */}
          {quietClients.length > 0 ? (
            <div className="s-card flex flex-wrap items-center gap-x-5 gap-y-2 border-l-[3px] !border-l-[var(--s-accent)] px-4 py-3">
              <p className="m-0 max-w-[62ch] text-[14px] leading-relaxed">
                <span className="s-num font-semibold">{quietClients.length}</span>{' '}
                {quietClients.length === 1 ? 'client has' : 'clients have'} had no contact for over
                a week
                {pool.length > 0 ? (
                  <>
                    , and{' '}
                    <span className="s-num font-semibold">{pool.length}</span>{' '}
                    {pool.length === 1 ? 'has' : 'have'} nobody working on them
                  </>
                ) : null}
                . These never show up as overdue, because nobody set a date.
              </p>
              <Link
                href="/studio/clients"
                className="ml-auto whitespace-nowrap s-btn-ghost no-underline"
              >
                Go through them
              </Link>
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-2">
            {/* ── Who is waiting ── */}
            <section className="s-card overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 bg-[var(--s-surface-2)] px-4 py-2.5">
                <h2 className="m-0 text-[14.5px] font-semibold">Waiting on you</h2>
                <Link href="/studio/clients" className="text-[12.5px] text-[var(--s-accent)] no-underline">
                  All clients →
                </Link>
              </div>

              {due.length === 0 ? (
                <p className="m-0 px-4 py-4 text-[13.5px] italic text-[var(--s-ink-3)]">
                  Nobody is overdue a call. A client with no follow-up date never appears here —
                  setting one is what makes this list worth reading.
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col p-0">
                  {due.slice(0, 6).map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--s-rule-soft)] px-4 py-2.5 last:border-b-0"
                    >
                      <span className="text-[14px] font-medium">{c.name}</span>
                      {/* The studio's own column, in the studio's own colour. */}
                      <span
                        className="s-tag"
                        style={{
                          background: colourOf(c.stageColour).wash,
                          color: colourOf(c.stageColour).ink,
                        }}
                      >
                        {c.stageName}
                      </span>
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="s-num text-[12.5px] text-[var(--s-accent)] no-underline">
                          {c.phone}
                        </a>
                      ) : null}
                      <span className="w-full text-[13px] text-[var(--s-ink-2)]">{c.nextAction}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── Money out ── */}
            <section className="s-card overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 bg-[var(--s-surface-2)] px-4 py-2.5">
                <h2 className="m-0 text-[14.5px] font-semibold">Owed to trades</h2>
                <Link href="/studio/vendors" className="text-[12.5px] text-[var(--s-accent)] no-underline">
                  The ledger →
                </Link>
              </div>

              {owed === 0 ? (
                <p className="m-0 px-4 py-4 text-[13.5px] italic text-[var(--s-ink-3)]">
                  Nothing outstanding.
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col p-0">
                  {vendors
                    .filter((v) => v.balancePaise > 0)
                    .slice(0, 6)
                    .map((v) => (
                      <li
                        key={v.id}
                        className="flex flex-wrap items-baseline gap-x-3 border-b border-[var(--s-rule-soft)] px-4 py-2.5 last:border-b-0"
                      >
                        <span className="text-[14px] font-medium">{v.name}</span>
                        <span className="s-tag">{v.trade}</span>
                        <span className="s-num ml-auto text-[14px] font-semibold text-[var(--s-accent)]">
                          {formatINR(v.balancePaise)}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </div>

          {/* ── From the marketplace. Last, and honestly sized. ── */}
          <section className="s-card overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 bg-[var(--s-surface-2)] px-4 py-2.5">
              <h2 className="m-0 text-[14.5px] font-semibold">From One Interiors</h2>
              <Link href="/studio/calendar" className="text-[12.5px] text-[var(--s-accent)] no-underline">
                Calendar →
              </Link>
            </div>

            <div className="grid gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2">
              <div>
                <p className="s-label m-0">Briefs you appeared in</p>
                <p className="s-num m-0 mt-0.5 text-[24px] font-semibold leading-none">
                  {briefs.thisMonth}
                </p>
                <p className="m-0 mt-1 text-[12.5px] text-[var(--s-ink-3)]">
                  {briefs.thisMonth === 0 && briefs.lastMonth === 0
                    ? 'this month, or last'
                    : briefs.lastMonth === 0
                      ? 'this month — your first'
                      : briefs.thisMonth === briefs.lastMonth
                        ? `this month, same as last`
                        : briefs.thisMonth > briefs.lastMonth
                          ? `this month, up from ${briefs.lastMonth}`
                          : `this month, down from ${briefs.lastMonth}`}
                </p>
              </div>

              <div>
                <p className="s-label m-0">{next.length > 0 ? 'Next meeting' : 'Nothing booked'}</p>
                {next[0] ? (
                  <>
                    <p className="m-0 mt-0.5 text-[15px] font-medium leading-snug">
                      {formatSlot(next[0].startsAt)}
                    </p>
                    <p className="m-0 mt-0.5 text-[12.5px] text-[var(--s-ink-3)]">
                      {[
                        KIND_LABELS[next[0].kind],
                        localityLabel(next[0].locality),
                        next[0].customerName,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </>
                ) : (
                  <p className="m-0 mt-1 max-w-[42ch] text-[12.5px] leading-relaxed text-[var(--s-ink-3)]">
                    Meetings appear once a customer has chosen you on a call with our expert.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </PageBody>
    </>
  );
}

function Stat({
  href,
  label,
  value,
  note,
  urgent = false,
}: {
  href: string;
  label: string;
  value: string;
  note: string;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`s-card block p-4 no-underline transition-colors hover:border-[var(--s-ink-3)] ${
        urgent ? '!border-[var(--s-accent)]' : ''
      }`}
    >
      <p className="s-label m-0">{label}</p>
      <p
        className={`s-num m-0 mt-1 text-[26px] font-semibold leading-none ${
          urgent ? 'text-[var(--s-accent)]' : ''
        }`}
      >
        {value}
      </p>
      <p className="m-0 mt-1.5 text-[12.5px] text-[var(--s-ink-3)]">{note}</p>
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
  const { steps, done, total } = onboardingProgress(studio);
  const remaining = steps.filter((s) => !s.done);

  if (studio.submittedForReview) {
    return (
      <main className="py-14">
        <Container size="narrow">
          <p className="label m-0 mb-3">{studio.tradeName}</p>
          <h1 className="display mb-5 text-[clamp(2rem,5vw,3rem)] leading-[1.05]">With us now.</h1>
          <p className="m-0 mb-6 max-w-[54ch] text-[17px] leading-relaxed text-[var(--color-ink-2)]">
            You have finished your side. We are verifying — company records, GST filing history,
            two reference calls and a visit to two completed sites.
          </p>
          <p className="m-0 max-w-[54ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            About a week, and we call you either way. The rest of the software — quotations,
            clients, your vendor ledger — opens the day you go live.
          </p>
        </Container>
      </main>
    );
  }

  return (
    <main className="py-14">
      <Container size="narrow">
        <p className="label m-0 mb-3">{studio.tradeName}</p>
        <h1 className="display mb-5 text-[clamp(2rem,5vw,3rem)] leading-[1.05]">
          {done === 0 ? `Welcome. ${total} steps.` : `${total - done} to go.`}
        </h1>
        <p className="m-0 mb-10 max-w-[54ch] text-[17px] leading-relaxed text-[var(--color-ink-2)]">
          This is the part only you can do. Take your time over the description and the projects —
          those are what a customer reads before deciding to meet you. Everything saves as you go.
        </p>

        <ol className="m-0 flex list-none flex-col gap-5 p-0">
          {remaining.map((s) => (
            <li key={s.step}>
              <Link
                href={`/studio/onboarding/${s.step}`}
                className="block border-l-2 border-[var(--color-rule)] pl-5 no-underline hover:border-[var(--color-petrol)]"
              >
                <span className="block font-[family-name:var(--font-display)] text-[21px] leading-tight text-[var(--color-ink)]">
                  {STEP_LABELS[s.step]}
                </span>
                {s.missing.length > 0 ? (
                  <span className="mt-1 block text-[15px] leading-relaxed text-[var(--color-ink-3)]">
                    {s.missing.join(', ')}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ol>

        {done > 0 ? (
          <p className="m-0 mt-10 text-[14.5px] text-[var(--color-ink-3)]">
            {done} of {total} done.
          </p>
        ) : null}
      </Container>
    </main>
  );
}
