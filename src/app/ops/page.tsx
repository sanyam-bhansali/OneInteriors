import Link from 'next/link';
import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { requireRole } from '@/modules/auth/session';
import { studioRepository } from '@/modules/studio/repository';
import { assessTier } from '@/modules/verification/tiers';
import { rosterCapacity } from '@/modules/studio/allocation';
import { funnelSummary } from '@/modules/analytics/record';
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
export default async function OpsOverview() {
  await requireRole('OPS');

  const [studios, capacity, funnel, pendingApplications, openConsultations] = await Promise.all([
    studioRepository.list(),
    rosterCapacity(),
    funnelSummary(30),
    countApplications(),
    countConsultations(),
  ]);

  const assessed = studios.map((s) => ({ studio: s, assessment: assessTier(s) }));

  const needsWork = assessed.filter((a) => a.assessment.blockers.length > 0).length;
  const expired = assessed.filter((a) => a.assessment.expired.length > 0).length;
  const onboarding = studios.filter((s) => s.status === 'ONBOARDING').length;
  const noRates = studios.filter((s) => s.status === 'ACTIVE' && s.minProjectPaise === null).length;

  // Demand the roster could absorb this month, if every live studio filled the
  // capacity it declared. Null when too few studios have told us.
  const absorbable =
    capacity.unknownCapacity === capacity.live ? null : capacity.declaredCapacity;

  const todo = (
    [
      { count: pendingApplications, label: 'applications waiting on a decision', href: '/ops/applications', tone: 'warn' },
      { count: expired, label: 'studios with a lapsed check still showing a badge', href: '/ops/verification', tone: 'bad' },
      { count: openConsultations, label: 'expert calls requested and not yet booked', href: '/ops/consultations', tone: 'bad' },
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

          <p className="m-0 max-w-[64ch] text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
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

/** Expert calls requested and not yet scheduled. */
async function countConsultations(): Promise<number> {
  if (!hasDatabase()) return 0;
  try {
    return await prisma.consultation.count({ where: { scheduledFor: null } });
  } catch {
    return 0;
  }
}
