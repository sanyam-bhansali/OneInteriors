import Link from 'next/link';
import type { Metadata } from 'next';
import { Container, TierBadge, Pill } from '@/components/ui';
import { studioRepository } from '@/modules/studio/repository';
import { assessTier, tierDrift } from '@/modules/verification/tiers';
import { validateGstin } from '@/modules/verification/gstin';
import { OpsHeader, TierProgress } from '../ui';

export const metadata: Metadata = {
  title: 'Verification queue',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The verification queue.
 *
 * Ordered by what needs a human first, not alphabetically: the closer a studio
 * is to promotion, the more valuable an hour of ops time spent on it — and
 * expired checks jump the queue, because a studio with a lapsed check is
 * currently showing a badge the evidence no longer supports.
 *
 * Access is gated by `app/ops/layout.tsx`, which redirects. Not by
 * `requireRole` here — that throws, and a throw in a page renders a 500 rather
 * than sending a stray customer home. See the note on the overview page.
 */
export default async function VerificationQueue() {
  const studios = await studioRepository.list();

  const rows = studios
    .map((s) => {
      const assessment = assessTier(s);
      const drift = tierDrift(s);
      const gstin = s.gstin ? validateGstin(s.gstin) : null;
      const done = assessment.progress.listed.passed + assessment.progress.verified.passed;
      const total = assessment.progress.listed.total + assessment.progress.verified.total;
      return { studio: s, assessment, drift, gstin, done, total };
    })
    .sort((a, b) => {
      // Expired first, then closest to complete.
      const ax = a.assessment.expired.length > 0 ? 0 : 1;
      const bx = b.assessment.expired.length > 0 ? 0 : 1;
      if (ax !== bx) return ax - bx;
      return b.done / b.total - a.done / a.total;
    });

  const needingWork = rows.filter((r) => r.assessment.blockers.length > 0).length;
  const expired = rows.filter((r) => r.assessment.expired.length > 0).length;
  const badGstin = rows.filter((r) => r.gstin && !r.gstin.valid).length;

  return (
    <>
      <OpsHeader />

      <main className="py-8">
        <Container size="wide">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label m-0 mb-2">Verification queue</p>
              <h1 className="h1">{studios.length} studios</h1>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              <QueueStat label="Need work" value={needingWork} tone={needingWork ? 'warn' : 'ok'} />
              <QueueStat label="Expired checks" value={expired} tone={expired ? 'bad' : 'ok'} />
              <QueueStat label="Invalid GSTIN" value={badGstin} tone={badGstin ? 'bad' : 'ok'} />
            </dl>
          </div>

          <div className="scroll-x rounded-[10px] border border-[var(--color-rule)]">
            <table className="w-full min-w-[900px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                  <Th>Studio</Th>
                  <Th>Tier</Th>
                  <Th>Checks</Th>
                  <Th>GSTIN</Th>
                  <Th>Blocking</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ studio, assessment, drift, gstin, done, total }) => (
                  <tr
                    key={studio.id}
                    className="border-b border-[var(--color-rule-soft)] align-top last:border-b-0"
                  >
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/ops/${studio.slug}`}
                        className="font-bold text-[var(--color-ink)] no-underline hover:text-[var(--color-petrol)]"
                      >
                        {studio.tradeName}
                      </Link>
                      <p className="m-0 text-[12.5px] text-[var(--color-ink-3)]">
                        {studio.legalName}
                      </p>
                      {studio.status !== 'ACTIVE' ? (
                        <Pill tone="atrisk">{studio.status}</Pill>
                      ) : null}
                      {studio.pausedAt ? <Pill tone="atrisk">Paused</Pill> : null}
                    </td>

                    <td className="px-4 py-3.5">
                      <TierBadge tier={assessment.tier} />
                      {/* Drift means a stored tier the checks do not support —
                          a bug or a bypass, and worth shouting about. */}
                      {drift.drifted ? (
                        <p className="m-0 mt-1 text-[11px] text-[var(--color-atrisk)]">
                          stored {drift.stored}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-3.5">
                      <TierProgress done={done} total={total} />
                      {assessment.expired.length > 0 ? (
                        <p className="m-0 mt-1.5 text-[11.5px] text-[var(--color-atrisk)]">
                          {assessment.expired.length} expired
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-3.5">
                      {!studio.gstin ? (
                        <span className="text-[13px] italic text-[var(--color-ink-3)]">None</span>
                      ) : gstin?.valid ? (
                        <>
                          <span className="tabular font-[family-name:var(--font-mono)] text-[12px]">
                            {studio.gstin}
                          </span>
                          <p className="m-0 text-[11.5px] text-[var(--color-ink-3)]">
                            {gstin.parts.stateName} · {gstin.parts.holderType}
                          </p>
                        </>
                      ) : (
                        <>
                          <span className="tabular font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-atrisk)]">
                            {studio.gstin}
                          </span>
                          <p className="m-0 text-[11.5px] text-[var(--color-atrisk)]">
                            {gstin && !gstin.valid ? gstin.reason : ''}
                          </p>
                        </>
                      )}
                    </td>

                    <td className="max-w-[280px] px-4 py-3.5">
                      {assessment.blockers.length === 0 ? (
                        <span className="text-[13px] text-[var(--color-ontrack)]">
                          Nothing — at top tier
                        </span>
                      ) : (
                        <ul className="m-0 list-none p-0">
                          {assessment.blockers.slice(0, 3).map((b) => (
                            <li key={b} className="text-[12.5px] leading-snug text-[var(--color-ink-2)]">
                              {b}
                            </li>
                          ))}
                          {assessment.blockers.length > 3 ? (
                            <li className="text-[12.5px] text-[var(--color-ink-3)]">
                              +{assessment.blockers.length - 3} more
                            </li>
                          ) : null}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </main>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="label px-4 py-3 text-left font-medium">{children}</th>;
}

function QueueStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'bad';
}) {
  const colour =
    tone === 'bad'
      ? 'text-[var(--color-atrisk)]'
      : tone === 'warn'
        ? 'text-[var(--color-brass)]'
        : 'text-[var(--color-ontrack)]';
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="label m-0">{label}</dt>
      <dd className={`tabular m-0 font-[family-name:var(--font-display)] text-[26px] leading-none ${colour}`}>
        {value}
      </dd>
    </div>
  );
}
