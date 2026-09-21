import Link from 'next/link';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { studioRepository } from '@/modules/studio/repository';
import { assessTier } from '@/modules/verification/tiers';
import { rosterCapacity } from '@/modules/studio/allocation';
import { introductionsNeedingUs } from '@/modules/studio/introduction-ops';
import { funnelSummary } from '@/modules/analytics/record';
import { missingCoreRates } from '@/modules/quotation/categories';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { OpsHeader } from './ui';

export const metadata: Metadata = {
  title: 'Overview',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The morning screen.
 *
 * ## What this page is for
 *
 * Not "everything we know" — that is what the other five routes are. This
 * answers two questions, in this order: **what needs a human today**, and **is
 * supply keeping up with demand**.
 *
 * The second question is the one that actually runs the business. A marketplace
 * fails in two opposite directions and they need different responses: buy
 * demand the roster cannot absorb and you produce customers nobody can serve;
 * sign studios you have no briefs for and they churn inside a quarter. Both
 * look like "growth" on a single-number dashboard, which is why the two sides
 * are counted separately here.
 *
 * Figures that cannot be computed render as "not enough data" rather than zero.
 * A dashboard that reports 0% drop-off on a step nobody has reached is worse
 * than one that admits it does not know.
 */
/**
 * No `requireRole` here on purpose.
 *
 * `app/ops/layout.tsx` gates every route under /ops and does it with a
 * `redirect`, which is the right behaviour for a page: a customer who wanders
 * in gets sent home rather than shown a stack trace. `requireRole` THROWS,
 * which is right for a server action — an action is directly invocable and
 * should fail hard — and wrong here, because Next renders the layout and the
 * page in parallel, so the throw surfaces as a 500 before the redirect lands.
 *
 * Mutations still call `requireRole` themselves. A layout guard protects
 * rendering, never writes.
 */
export default async function OpsOverview() {
  const [
    studios,
    withHidden,
    capacity,
    funnel,
    pendingApplications,
    openConsultations,
    awaitingReview,
    missingRates,
    introductionsWaiting,
  ] = await Promise.all([
    studioRepository.list(),
    // The ONE read in the app that asks for hidden rows, because this is where
    // you get one back. Everything else — the roster, matching, /expert, every
    // count above — inherits the exclusion from the repository by saying
    // nothing, which is the point of the default.
    studioRepository.list({ includeHidden: true }),
    rosterCapacity(),
    funnelSummary(30),
    countApplications(),
    countConsultations(),
    countAwaitingReview(),
    countWithoutRateCard(),
    introductionsNeedingUs(),
  ]);

  const assessed = studios.map((s) => ({ studio: s, assessment: assessTier(s) }));

  // Derived from the one list that includes them, so it cannot disagree with
  // what `studios` excluded.
  const hidden = withHidden.filter((s) => s.hiddenAsTestAt);

  const needsWork = assessed.filter((a) => a.assessment.blockers.length > 0).length;
  const expired = assessed.filter((a) => a.assessment.expired.length > 0).length;
  const onboarding = studios.filter((s) => s.status === 'ONBOARDING').length;

  /**
   * `missingRates` comes from the rate-card table, not from `minProjectPaise`.
   *
   * The old test was `s.minProjectPaise === null`, which is the project SIZE
   * RANGE off the profile step — a different field with a similar-sounding
   * name. A studio could have a complete range and an entirely empty rate card
   * and read as fine here, while being unquotable to every customer. The pill
   * on /ops/allocation said "No rate card" off the same wrong column.
   */
  const noRates = missingRates;

  // Demand the roster could absorb this month, if every live studio filled the
  // capacity it declared. Null when too few studios have told us.
  const absorbable =
    capacity.unknownCapacity === capacity.live ? null : capacity.declaredCapacity;

  const todo = (
    [
      { count: pendingApplications, label: 'applications waiting on a decision', href: '/ops/applications', tone: 'warn' },
      // The event ops most needs to act on after approval, and which had no
      // queue item at all — a studio finished onboarding and we found out by
      // accident.
      { count: awaitingReview, label: 'studios have finished onboarding and are waiting on verification', href: '/ops/verification', tone: 'warn' },
      { count: expired, label: 'studios with a lapsed check still showing a badge', href: '/ops/verification', tone: 'bad' },
      { count: openConsultations, label: 'expert calls requested and not yet booked', href: '/ops/consultations', tone: 'bad' },
      // The half of the funnel this overview could not see. An introduction
      // with no meeting arranged is a customer who was handed over on the phone
      // and then heard nothing — the most expensive silence in the product,
      // because it happens after they have already said yes.
      { count: introductionsWaiting, label: 'introductions waiting on us — no meeting, no confirmation, or no outcome', href: '/ops/introductions', tone: 'bad' },
      { count: noRates, label: 'live studios with no rate card — they cannot be quoted', href: '/ops/allocation', tone: 'bad' },
      { count: needsWork, label: 'studios one or more checks short of their next tier', href: '/ops/verification', tone: 'warn' },
      { count: capacity.unknownCapacity, label: 'live studios who have not told us their capacity', href: '/ops/allocation', tone: 'warn' },
    ] as const
  ).filter((t) => t.count > 0);

  return (
    <>
      <OpsHeader />

      <main className="py-8">
        <Container size="wide">
          <p className="label m-0 mb-2">Overview</p>
          <h1 className="h1 mb-8">
            {todo.length === 0 ? 'Nothing is waiting on you.' : 'What needs a human today.'}
          </h1>

          {/* ── The queue of actual work ───────────────── */}
          <section className="mb-12">
            {todo.length === 0 ? (
              <p className="m-0 max-w-[62ch] rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-6 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
                No applications pending, no lapsed checks, no unbooked calls, and every live studio
                has rates and a declared capacity. Worth spending the time on supply — the numbers
                below say whether the roster can take what you are about to buy.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-px overflow-hidden rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-rule)] p-0">
                {todo.map((t) => (
                  <li key={t.label}>
                    <Link
                      href={t.href}
                      className="flex items-baseline gap-4 bg-[var(--color-paper-2)] px-5 py-4 no-underline transition-colors hover:bg-[var(--color-paper-3)]"
                    >
                      <span
                        className={`tabular font-[family-name:var(--font-display)] text-[26px] leading-none ${
                          t.tone === 'bad' ? 'text-[var(--color-atrisk)]' : 'text-[var(--color-brass)]'
                        }`}
                      >
                        {t.count}
                      </span>
                      <span className="flex-1 text-[15px] leading-snug text-[var(--color-ink-2)]">
                        {t.label}
                      </span>
                      <span aria-hidden="true" className="text-[var(--color-ink-3)]">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Supply and demand, counted separately ──── */}
          <section className="mb-12">
            <h2 className="h2 mb-2">Supply and demand</h2>
            <p className="m-0 mb-6 max-w-[64ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
              Counted as two things on purpose. A blended number hides which side is leaking, and
              the two fail in opposite directions — demand you cannot place is as bad as studios you
              cannot feed.
            </p>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Panel title="Supply">
                <Figure label="Live studios" value={capacity.live} />
                <Figure label="Paused" value={capacity.paused} tone={capacity.paused ? 'warn' : undefined} />
                <Figure label="Still onboarding" value={onboarding} />
                <Figure
                  label="Projects a month the roster says it can take"
                  value={absorbable}
                  empty={`Nobody has declared capacity yet`}
                />
              </Panel>

              <Panel title="Demand · last 30 days">
                <Figure label="Briefs started" value={funnel.quizStarts} />
                <Figure label="Briefs finished" value={funnel.quizCompletions} />
                <Figure
                  label="Completion rate"
                  value={funnel.completionRate === null ? null : `${Math.round(funnel.completionRate * 100)}%`}
                  empty="No briefs started yet"
                />
                <Figure label="Expert calls requested" value={funnel.enquiries} />
              </Panel>
            </div>

            {/* The sentence that matters, when both sides can be measured. */}
            {absorbable !== null && funnel.quizCompletions > 0 ? (
              <p className="m-0 mt-6 max-w-[64ch] rounded-[10px] border-l-2 border-[var(--color-brass)] bg-[var(--color-paper-2)] px-5 py-4 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
                {funnel.quizCompletions > absorbable ? (
                  <>
                    <strong>{funnel.quizCompletions} finished briefs</strong> against a roster that
                    says it can take <strong>{absorbable} projects a month</strong>. You are buying
                    more demand than the city can serve — the next rupee is better spent signing
                    studios than on leads.
                  </>
                ) : (
                  <>
                    <strong>{funnel.quizCompletions} finished briefs</strong> against capacity for{' '}
                    <strong>{absorbable}</strong>. The roster has room. Studios who are not seeing
                    briefs are studios about to churn, so this is the gap to close with demand.
                  </>
                )}
              </p>
            ) : null}
          </section>

          {/* The undo. Hiding a row removes it from every other surface, so if
              it were not listed here it could not be got back — which would
              make "hidden" a euphemism for deleted. Deliberately plain and at
              the bottom: it is housekeeping, not a queue. */}
          {hidden.length > 0 ? (
            <section className="mt-10 border-t border-[var(--color-rule)] pt-6">
              <p className="label m-0 mb-1">Hidden test records ({hidden.length})</p>
              <p className="m-0 mb-4 max-w-[60ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
                Not on the roster, not matchable, and in none of the numbers above. Open one to
                put it back.
              </p>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {hidden.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/ops/${s.slug}`}
                      className="text-[14px] text-[var(--color-ink)] underline decoration-[var(--color-rule)] underline-offset-4 hover:decoration-[var(--color-petrol)]"
                    >
                      {s.tradeName}
                    </Link>{' '}
                    <span className="text-[12.5px] text-[var(--color-ink-2)]">
                      · hidden{' '}
                      {s.hiddenAsTestAt
                        ? new Date(s.hiddenAsTestAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="m-0 mt-8 max-w-[64ch] text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
            Every figure here is computed from our own tables. No third-party analytics script runs
            on the site, and nothing that resembles a name, email or phone number is written to an
            event row.
          </p>
        </Container>
      </main>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-6">
      <p className="label m-0 mb-4">{title}</p>
      <dl className="m-0 flex flex-col gap-4">{children}</dl>
    </div>
  );
}

/**
 * A figure, or an honest absence of one.
 *
 * `null` renders as the reason rather than as zero. "0 projects a month" and
 * "nobody has told us yet" are different facts and the first one would send ops
 * off to fix a supply problem that does not exist.
 */
function Figure({
  label,
  value,
  empty,
  tone,
}: {
  label: string;
  value: number | string | null;
  empty?: string;
  tone?: 'warn';
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-rule-soft)] pb-3 last:border-b-0 last:pb-0">
      <dt className="m-0 max-w-[26ch] text-[14px] leading-snug text-[var(--color-ink-2)]">{label}</dt>
      <dd className="m-0 text-right">
        {value === null ? (
          <span className="text-[13px] italic text-[var(--color-ink-3)]">{empty ?? 'Not enough data'}</span>
        ) : (
          <span
            className={`tabular font-[family-name:var(--font-display)] text-[28px] leading-none ${
              tone === 'warn' ? 'text-[var(--color-brass)]' : 'text-[var(--color-ink)]'
            }`}
          >
            {value}
          </span>
        )}
      </dd>
    </div>
  );
}

/** Applications nobody has decided on. Degrades to 0 without a database. */
async function countApplications(): Promise<number> {
  if (!hasDatabase()) return 0;
  try {
    return await prisma.studioApplication.count({
      where: { status: { in: ['SUBMITTED', 'REVIEWING'] } },
    });
  } catch {
    return 0;
  }
}

/**
 * Expert calls that still need a time putting on them.
 *
 * Keyed off `status`, and only `requested`. The old query was
 * `{ scheduledFor: null }` against a column **nothing in the codebase wrote**,
 * so it counted every consultation ever created — completed ones included — and
 * never went down. A permanent red number on the screen ops opens first thing
 * is worse than no number: it teaches people to ignore the queue.
 *
 * `scheduled` is excluded deliberately. A row on a to-do list has to disappear
 * when you do the thing it asks for, or it is not a to-do list.
 */
async function countConsultations(): Promise<number> {
  if (!hasDatabase()) return 0;
  try {
    /* `requested` AND `scheduled`, because that is what the page this links
       to shows. The overview counted `requested` alone, so the badge said 2
       and /ops/consultations opened on "4 waiting" — the same concept counted
       two different ways, which is how an operator learns to distrust the
       queue. A call that is booked but not yet held still needs a human. */
    return await prisma.consultation.count({
      where: { status: { in: ['requested', 'scheduled'] } },
    });
  } catch {
    return 0;
  }
}

/**
 * Live studios that cannot be quoted, read from the rate card itself.
 *
 * "Core categories priced" is the real test — `missingCoreRates` is the same
 * function the studio's own onboarding uses to decide whether the rates step is
 * done, so the two surfaces cannot disagree about what "has rates" means.
 */
async function countWithoutRateCard(): Promise<number> {
  if (!hasDatabase()) return 0;
  try {
    const rows = await prisma.studio.findMany({
      where: { status: 'ACTIVE' },
      select: { rateCard: { select: { category: true, ratePaise: true } } },
    });
    return rows.filter((row) => missingCoreRates(ratesOf(row.rateCard)).length > 0).length;
  } catch {
    return 0;
  }
}

/** The shape `missingCoreRates` wants: category → paise. */
function ratesOf(items: { category: string; ratePaise: bigint }[]): Record<string, number> {
  const card: Record<string, number> = {};
  for (const item of items) card[item.category] = Number(item.ratePaise);
  return card;
}

/**
 * Studios who have finished their side and are waiting on us.
 *
 * This is the event ops most needs to act on after approval, and there was no
 * queue item for it: `onboardingSteps.submittedForReview` is written by the
 * studio and was read by nothing on the ops side. A studio finished onboarding
 * and we found out by accident.
 *
 * Read through the JSON column rather than a dedicated boolean because that is
 * where the studio surface already writes it — a second source of the same fact
 * is how the two get to disagree.
 */
async function countAwaitingReview(): Promise<number> {
  if (!hasDatabase()) return 0;
  try {
    const rows = await prisma.studio.findMany({
      where: { status: 'ONBOARDING' },
      select: { onboardingSteps: true },
    });
    return rows.filter((row) => {
      const steps = row.onboardingSteps as { submittedForReview?: boolean } | null;
      return steps?.submittedForReview === true;
    }).length;
  } catch {
    return 0;
  }
}
