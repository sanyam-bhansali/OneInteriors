import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { studioRepository } from '@/modules/studio/repository';
import { rosterCapacity } from '@/modules/studio/allocation';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { OpsHeader } from '../ui';
import { StudioRow, type AllocationRow } from './StudioRow';
import { SweepButton } from './SweepButton';

export const metadata: Metadata = {
  title: 'Allocation',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Allocation — volume, never position.
 *
 * ## Why this screen looks the way it does
 *
 * The subscription sells how many briefs a studio is put in front of. So the
 * first number on every row is how many times that studio has actually
 * appeared in a customer's matches — because that is the thing they are paying
 * for, and a studio that cannot see it is paying for a black box. Supply churns
 * for reasons demand never does, and "I have no idea what I am getting" is the
 * most common of them.
 *
 * There is no control here that moves a studio up somebody's results. Order
 * comes from the matching engine, and `score.ts` reads exactly one field that
 * this page can write — `pausedAt` — which can only remove a studio, never
 * promote one. Keeping that true structurally is cheaper than keeping it true
 * by policy.
 */
export default async function AllocationPage() {
  const [studios, capacity, shownCounts] = await Promise.all([
    studioRepository.list(),
    rosterCapacity(),
    shownLast30Days(),
  ]);

  const rows: AllocationRow[] = studios
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      tradeName: s.tradeName,
      tier: s.tier,
      status: s.status,
      pausedAt: s.pausedAt,
      pausedReason: s.pausedReason,
      pauseCause: s.pauseCause,
      capacityPerMonth: s.capacityPerMonth,
      hasRates: s.minProjectPaise !== null,
      shown: shownCounts[s.id] ?? 0,
    }))
    // Paused first — they are invisible to customers and somebody has to decide
    // whether that is still right. Then by how little volume they are getting,
    // because that is the churn list.
    .sort((a, b) => {
      const ap = a.pausedAt ? 0 : 1;
      const bp = b.pausedAt ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.shown - b.shown;
    });

  return (
    <>
      <OpsHeader />

      <main className="py-8">
        <Container size="wide">
          <p className="label m-0 mb-2">Allocation</p>
          <h1 className="h1 mb-3">How often each studio is shown.</h1>
          <p className="m-0 mb-8 max-w-[66ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
            A subscription buys volume — how many briefs a studio appears for. It never buys
            position: where a studio lands in one customer&rsquo;s results is computed from fit, and
            nothing on this page can change it. Pausing removes a studio entirely; it cannot move
            anyone up.
          </p>

          <div className="mb-8">
            <SweepButton />
            <p className="m-0 mt-2 max-w-[66ch] text-[13px] leading-relaxed text-[var(--color-ink-3)]">
              Pauses anyone who has hit the capacity they declared or gone past due on payment, and
              puts back anyone whose reason has cleared. A studio suspended by hand stays suspended
              — only a person lifts that.
            </p>
          </div>

          <dl className="mb-8 flex flex-wrap gap-x-10 gap-y-4">
            <Stat label="In rotation" value={capacity.live} />
            <Stat label="Paused" value={capacity.paused} tone={capacity.paused ? 'warn' : undefined} />
            <Stat
              label="Projects a month the roster can take"
              value={capacity.unknownCapacity === capacity.live ? null : capacity.declaredCapacity}
            />
            <Stat
              label="Capacity undeclared"
              value={capacity.unknownCapacity}
              tone={capacity.unknownCapacity ? 'warn' : undefined}
            />
          </dl>

          <div className="scroll-x rounded-[10px] border border-[var(--color-rule)]">
            <table className="w-full min-w-[880px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                  <Th>Studio</Th>
                  <Th align="right">Briefs shown for</Th>
                  <Th>Can take / month</Th>
                  <Th>Rotation</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <StudioRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 ? (
            <p className="m-0 mt-6 text-[15px] italic text-[var(--color-ink-3)]">
              No studios yet. They appear here once an application is approved.
            </p>
          ) : null}
        </Container>
      </main>
    </>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th className={`label px-4 py-3 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone?: 'warn';
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="label m-0 max-w-[22ch]">{label}</dt>
      <dd className="m-0">
        {value === null ? (
          <span className="text-[13px] italic text-[var(--color-ink-3)]">Nobody has said yet</span>
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

/**
 * How many times each studio has appeared in a customer's matches in 30 days.
 *
 * Read from stored `Match` rows rather than recomputed, so the number is what
 * customers were actually shown rather than what today's engine would produce
 * for yesterday's briefs. Degrades to an empty map rather than throwing — an
 * allocation screen that will not load is worse than one missing a column.
 */
async function shownLast30Days(): Promise<Record<string, number>> {
  if (!hasDatabase()) return {};
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const grouped = await prisma.match.groupBy({
      by: ['studioId'],
      where: { createdAt: { gte: since } },
      _count: { studioId: true },
    });
    return Object.fromEntries(grouped.map((g) => [g.studioId, g._count.studioId]));
  } catch {
    return {};
  }
}
