import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, TierBadge, Stat, Divider, Button, Pill } from '@/components/ui';
import { StyleScene } from '@/components/art/StyleScene';
import { PlanFragment } from '@/components/art/PlanFragment';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { studioRepository } from '@/modules/studio/repository';
import { formatINRCompact } from '@/lib/money';
import {
  CHECK_LABELS,
  TIER_CHECKS,
  TIER_DESCRIPTIONS,
  describeDelivery,
  type CheckResult,
  type VerificationCheck,
} from '@/modules/studio/types';
import { PROPERTY_LABELS, SCOPE_LABELS, STYLE_LABELS } from '@/modules/brief/types';

export async function generateStaticParams() {
  const slugs = await studioRepository.allSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const studio = await studioRepository.bySlug(slug);
  if (!studio) return {};
  return {
    title: studio.tradeName,
    description: `${studio.tradeName} — ${describeDelivery(studio)} Verified by One Interiors.`,
  };
}

export default async function StudioProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const studio = await studioRepository.bySlug(slug);
  if (!studio) notFound();

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;

  return (
    <>
      <SiteHeader />

      <main>
        {/* Identity */}
        <PlanFragment
          seed={studio.id}
          styles={studio.portfolio.flatMap((p) => p.styleTags)}
          className="block h-24 w-full sm:h-32"
        />
        <section className="border-y border-[var(--color-rule)] py-10">
          <Container>
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <h1 className="h1 mb-2">
                  {studio.tradeName}
                </h1>
                <p className="m-0 mb-4 max-w-[58ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
                  {studio.about}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <TierBadge tier={studio.tier} />
                  {studio.yearsActive ? <Pill>{studio.yearsActive} years active</Pill> : null}
                  {studio.teamSize ? <Pill>Team of {studio.teamSize}</Pill> : null}
                </div>
              </div>
              <Button href="/quiz">Get an indicative quote</Button>
            </div>
          </Container>
        </section>

        {/* Track record — the numbers first, including the bad ones. */}
        <section className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] py-8">
          <Container>
            <p className="m-0 mb-5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
              Track record
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
              <Stat
                label="Completed with us"
                value={studio.completedProjects > 0 ? String(studio.completedProjects) : null}
                empty="None yet"
              />
              <Stat
                label="Average variance to committed date"
                value={
                  studio.avgVarianceDays === null
                    ? null
                    : `${studio.avgVarianceDays > 0 ? '+' : ''}${Math.round(studio.avgVarianceDays)} days`
                }
                tone={
                  studio.avgVarianceDays === null
                    ? 'default'
                    : studio.avgVarianceDays <= 10
                      ? 'ontrack'
                      : 'atrisk'
                }
              />
              <Stat
                label="Disputes upheld"
                value={studio.completedProjects > 0 ? String(studio.upheldDisputes) : null}
                tone={studio.upheldDisputes > 0 ? 'atrisk' : 'ontrack'}
              />
              <Stat
                label="Materials matched the quote"
                value={
                  studio.specComplianceRate === null
                    ? null
                    : `${Math.round(studio.specComplianceRate * 100)}%`
                }
              />
            </div>
            <p className="m-0 mt-5 max-w-[64ch] border-t border-[var(--color-rule)] pt-4 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
              {describeDelivery(studio)}{' '}
              {studio.completedProjects === 0
                ? 'These figures only exist once a studio has completed a project on a milestone plan we monitored — so a new studio shows nothing here rather than an estimate.'
                : 'Every figure here is computed from milestone approvals, not self-reported.'}
            </p>
          </Container>
        </section>

        {/* What we verified — a checklist with sources and dates, never a badge */}
        <section className="border-b border-[var(--color-rule)] py-10">
          <Container>
            <p className="m-0 mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
              What we verified
            </p>
            <h2 className="h2 mb-2">
              Twelve checks, each with a source and a date.
            </h2>
            <p className="m-0 mb-7 max-w-[62ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
              {TIER_DESCRIPTIONS[studio.tier]} Interior design is an unregulated profession in India
              — there is no licence to check — so we verify the business and its trading history,
              and we are explicit about what that does and does not prove.
            </p>

            <div className="grid grid-cols-1 gap-x-10 gap-y-0 sm:grid-cols-2">
              <CheckGroup
                title="Identity"
                checks={studio.checks.filter((c) => TIER_CHECKS.LISTED.includes(c.type))}
                formatDate={formatDate}
              />
              <CheckGroup
                title="Trading history"
                checks={studio.checks.filter((c) => TIER_CHECKS.VERIFIED.includes(c.type))}
                formatDate={formatDate}
              />
            </div>

            {studio.gstin ? (
              <p className="mt-7 border-t border-[var(--color-rule-soft)] pt-4 font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-ink-3)]">
                GSTIN {studio.gstin} · verifiable free on the GST portal
              </p>
            ) : null}
          </Container>
        </section>

        {/* Portfolio, tagged so it is comparable rather than just pretty */}
        <section className="py-10">
          <Container>
            <p className="m-0 mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
              Work
            </p>
            <h2 className="h2 mb-7">
              {studio.portfolio.length} projects, with budgets and timelines attached.
            </h2>

            <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {studio.portfolio.map((p) => (
                <li key={p.id} className="lift border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                  <div className="relative">
                    <StyleScene
                      tag={p.styleTags[0] ?? 'contemporary-minimal'}
                      className="block aspect-[4/3] w-full"
                    />
                    <span className="absolute left-2 top-2 rounded-[2px] bg-[var(--color-paper)]/85 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.09em] text-[var(--color-ink-3)]">
                      Illustration · photo pending
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5 border-t border-[var(--color-rule)] p-4">
                    <h3 className="m-0 text-[15px] font-bold leading-snug">{p.title}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {p.propertyType ? <Pill>{PROPERTY_LABELS[p.propertyType]}</Pill> : null}
                      {p.scope ? <Pill>{SCOPE_LABELS[p.scope]}</Pill> : null}
                    </div>
                    <dl className="m-0 flex flex-wrap gap-x-5 gap-y-1">
                      {p.valuePaise ? (
                        <div>
                          <dt className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                            Value
                          </dt>
                          <dd className="tabular m-0 text-[14px]">{formatINRCompact(p.valuePaise)}</dd>
                        </div>
                      ) : null}
                      {p.durationDays ? (
                        <div>
                          <dt className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                            Duration
                          </dt>
                          <dd className="tabular m-0 text-[14px]">{p.durationDays} days</dd>
                        </div>
                      ) : null}
                    </dl>
                    <p className="m-0 text-[12px] leading-snug text-[var(--color-ink-3)]">
                      {p.styleTags.map((t) => STYLE_LABELS[t]).join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function CheckGroup({
  title,
  checks,
  formatDate,
}: {
  title: string;
  checks: VerificationCheck[];
  formatDate: (iso: string | null) => string | null;
}) {
  return (
    <div className="py-2">
      <h3 className="m-0 mb-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
        {title}
      </h3>
      <Divider />
      <ul className="m-0 list-none p-0">
        {checks.map((c) => (
          <li
            key={c.type}
            className="flex items-start gap-3 border-b border-[var(--color-rule-soft)] py-3"
          >
            <ResultGlyph result={c.result} />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[14px] leading-snug text-[var(--color-ink)]">
                {CHECK_LABELS[c.type]}
              </p>
              <p className="m-0 font-[family-name:var(--font-mono)] text-[11px] leading-snug text-[var(--color-ink-3)]">
                {c.result === 'PENDING'
                  ? (c.detail ?? 'In progress')
                  : c.result === 'NOT_APPLICABLE'
                    ? (c.detail ?? 'Not applicable')
                    : [c.source, formatDate(c.checkedAt)].filter(Boolean).join(' · ')}
              </p>
              {c.detail && c.result === 'PASS' ? (
                <p className="m-0 mt-0.5 text-[12px] leading-snug text-[var(--color-ink-3)]">
                  {c.detail}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shape carries the state as well as colour — never colour alone. */
function ResultGlyph({ result }: { result: CheckResult }) {
  const map: Record<CheckResult, { glyph: string; cls: string; label: string }> = {
    PASS: { glyph: '✓', cls: 'text-[var(--color-ontrack)]', label: 'Verified' },
    PENDING: { glyph: '◍', cls: 'text-[var(--color-brass)]', label: 'In progress' },
    FAIL: { glyph: '✕', cls: 'text-[var(--color-atrisk)]', label: 'Failed' },
    EXPIRED: { glyph: '◍', cls: 'text-[var(--color-brass)]', label: 'Expired, re-checking' },
    NOT_APPLICABLE: { glyph: '–', cls: 'text-[var(--color-ink-3)]', label: 'Not applicable' },
  };
  const { glyph, cls, label } = map[result];
  return (
    <span className={`mt-0.5 shrink-0 text-[14px] leading-none ${cls}`} title={label}>
      <span aria-hidden="true">{glyph}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
