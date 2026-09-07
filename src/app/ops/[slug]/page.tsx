import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, TierBadge, Pill, Divider } from '@/components/ui';
import { studioRepository } from '@/modules/studio/repository';
import { assessTier, hasExpired, REAUDIT_MONTHS } from '@/modules/verification/tiers';
import { validateGstin } from '@/modules/verification/gstin';
import { CHECK_LABELS, TIER_CHECKS, type CheckResult, type VerificationCheck } from '@/modules/studio/types';
import { formatINRCompact } from '@/lib/money';
import { OpsHeader, TierProgress } from '../ui';

export const metadata: Metadata = {
  title: 'Studio verification',
  robots: { index: false, follow: false },
};

/**
 * Never prerendered. The auth check in ops/layout.tsx already forces this
 * dynamic (it reads cookies), but stating it removes the ambiguity: an
 * authenticated page listing legal names and GSTINs should never have build-time
 * HTML sitting in the deployment artifact, and `generateStaticParams` here
 * would enumerate every studio slug for no benefit.
 */
export const dynamic = 'force-dynamic';

export default async function OpsStudio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const studio = await studioRepository.bySlug(slug);
  if (!studio) notFound();

  const assessment = assessTier(studio);
  const gstin = studio.gstin ? validateGstin(studio.gstin) : null;
  const now = new Date();

  return (
    <>
      <OpsHeader />

      <main className="py-8">
        <Container size="wide">
          <Link
            href="/ops"
            className="label mb-5 inline-block text-[var(--color-petrol)] no-underline"
          >
            ← Queue
          </Link>

          <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
            <div>
              <h1 className="h1 mb-2">{studio.tradeName}</h1>
              <p className="m-0 mb-3 text-[15px] text-[var(--color-ink-2)]">{studio.legalName}</p>
              <div className="flex flex-wrap items-center gap-2">
                <TierBadge tier={assessment.tier} />
                <Pill tone={studio.status === 'ACTIVE' ? 'ontrack' : 'atrisk'}>{studio.status}</Pill>
                {studio.minProjectPaise && studio.maxProjectPaise ? (
                  <Pill>
                    {formatINRCompact(studio.minProjectPaise)}–
                    {formatINRCompact(studio.maxProjectPaise)}
                  </Pill>
                ) : null}
              </div>
            </div>
            <Link
              href={`/studios/${studio.slug}`}
              className="label text-[var(--color-petrol)] no-underline"
            >
              Public profile ↗
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
            <div>
              {/* GSTIN — validated offline, before any paid lookup */}
              <section className="mb-8">
                <p className="label m-0 mb-3">GST registration</p>
                {!studio.gstin ? (
                  <p className="m-0 text-[15px] italic text-[var(--color-ink-3)]">
                    No GSTIN on file.
                  </p>
                ) : gstin?.valid ? (
                  <div className="rounded-[10px] border border-[var(--color-ontrack)] bg-[var(--color-ontrack-soft)] p-4">
                    <p className="tabular m-0 mb-2 font-[family-name:var(--font-mono)] text-[15px]">
                      {gstin.gstin}
                    </p>
                    <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                      <Field label="State" value={gstin.parts.stateName} />
                      <Field label="PAN" value={gstin.parts.pan} mono />
                      <Field label="Holder" value={gstin.parts.holderType} />
                      <Field label="Check digit" value={`${gstin.parts.checkDigit} ✓`} mono />
                    </dl>
                    <p className="m-0 mt-3 border-t border-[var(--color-ontrack)] pt-2.5 text-[12.5px] leading-snug text-[var(--color-ink-2)]">
                      Checksum valid — this is a well-formed GSTIN. It does <strong>not</strong>{' '}
                      prove the registration is active or that the trade name matches. That needs
                      the GST portal lookup (OI-6b).
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[10px] border border-[var(--color-atrisk)] bg-[var(--color-atrisk-soft)] p-4">
                    <p className="tabular m-0 mb-1.5 font-[family-name:var(--font-mono)] text-[15px] text-[var(--color-atrisk)]">
                      {studio.gstin}
                    </p>
                    <p className="m-0 text-[13.5px] text-[var(--color-ink-2)]">
                      {gstin && !gstin.valid ? gstin.reason : ''}
                    </p>
                  </div>
                )}
              </section>

              {/* The checks themselves */}
              <section>
                <p className="label m-0 mb-3">Checks</p>
                <CheckList
                  title="Tier 1 — Identity"
                  types={TIER_CHECKS.LISTED}
                  studioChecks={studio.checks}
                  now={now}
                />
                <CheckList
                  title={`Tier 2 — Trading history · re-audit every ${REAUDIT_MONTHS} months`}
                  types={TIER_CHECKS.VERIFIED}
                  studioChecks={studio.checks}
                  now={now}
                />
              </section>
            </div>

            {/* What is standing between this studio and the next tier */}
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-5">
                <p className="label m-0 mb-3">Progress</p>
                <TierProgress
                  done={assessment.progress.listed.passed + assessment.progress.verified.passed}
                  total={assessment.progress.listed.total + assessment.progress.verified.total}
                />

                <Divider className="my-4" />

                <p className="label m-0 mb-2">Blocking the next tier</p>
                {assessment.blockers.length === 0 ? (
                  <p className="m-0 text-[14px] text-[var(--color-ontrack)]">
                    Nothing. This studio is at the top tier.
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {assessment.blockers.map((b) => (
                      <li key={b} className="text-[13.5px] leading-snug text-[var(--color-ink-2)]">
                        {b}
                      </li>
                    ))}
                  </ul>
                )}

                <Divider className="my-4" />

                <p className="label m-0 mb-2">Delivery</p>
                <dl className="m-0 flex flex-col gap-2">
                  <Field label="Completed" value={String(studio.completedProjects)} />
                  <Field
                    label="Avg variance"
                    value={
                      studio.avgVarianceDays === null
                        ? 'No record'
                        : `${studio.avgVarianceDays > 0 ? '+' : ''}${Math.round(studio.avgVarianceDays)} days`
                    }
                  />
                  <Field label="Upheld disputes" value={String(studio.upheldDisputes)} />
                </dl>

                <p className="m-0 mt-4 border-t border-[var(--color-rule)] pt-3 text-[12px] leading-snug text-[var(--color-ink-3)]">
                  Tier is computed from these, never set by hand. To change how a studio is treated,
                  change its status — not its tier.
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </main>
    </>
  );
}

function CheckList({
  title,
  types,
  studioChecks,
  now,
}: {
  title: string;
  types: readonly (keyof typeof CHECK_LABELS)[];
  studioChecks: VerificationCheck[];
  now: Date;
}) {
  const map = new Map(studioChecks.map((c) => [c.type, c]));
  return (
    <div className="mb-6">
      <p className="m-0 mb-2 text-[13px] font-bold text-[var(--color-ink-2)]">{title}</p>
      <ul className="m-0 list-none rounded-[10px] border border-[var(--color-rule)] p-0">
        {types.map((t, i) => {
          const check = map.get(t);
          const expired = check ? hasExpired(check, now) : false;
          const result: CheckResult = expired ? 'EXPIRED' : (check?.result ?? 'PENDING');
          return (
            <li
              key={t}
              className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 ${
                i > 0 ? 'border-t border-[var(--color-rule-soft)]' : ''
              }`}
            >
              <span className="flex items-center gap-2.5 text-[14px] text-[var(--color-ink)]">
                <ResultDot result={result} />
                {CHECK_LABELS[t]}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-ink-3)]">
                {check?.source ?? '—'}
                {check?.checkedAt
                  ? ` · ${new Date(check.checkedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}`
                  : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ResultDot({ result }: { result: CheckResult }) {
  const map: Record<CheckResult, { cls: string; glyph: string }> = {
    PASS: { cls: 'text-[var(--color-ontrack)]', glyph: '●' },
    PENDING: { cls: 'text-[var(--color-brass)]', glyph: '◍' },
    FAIL: { cls: 'text-[var(--color-atrisk)]', glyph: '✕' },
    EXPIRED: { cls: 'text-[var(--color-atrisk)]', glyph: '◍' },
    NOT_APPLICABLE: { cls: 'text-[var(--color-ink-3)]', glyph: '–' },
  };
  const { cls, glyph } = map[result];
  return (
    <span className={`text-[12px] leading-none ${cls}`} title={result}>
      <span aria-hidden="true">{glyph}</span>
      <span className="sr-only">{result}</span>
    </span>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="label m-0">{label}</dt>
      <dd
        className={`m-0 text-[13.5px] text-[var(--color-ink)] ${mono ? 'tabular font-[family-name:var(--font-mono)]' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
