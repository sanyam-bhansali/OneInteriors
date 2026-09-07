import Link from 'next/link';
import { Container, Button, Eyebrow, TierBadge } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { FloorPlan } from '@/components/art/FloorPlan';
import { MilestoneTrack } from '@/components/art/MilestoneTrack';
import { StyleScene, MaterialSwatches } from '@/components/art/StyleScene';
import { PlanFragment } from '@/components/art/PlanFragment';
import { studioRepository } from '@/modules/studio/repository';
import { formatINRCompact } from '@/lib/money';
import { describeDelivery } from '@/modules/studio/types';
import type { StyleTag } from '@/modules/brief/types';
import { STYLE_LABELS } from '@/modules/brief/types';
import { TIER_CHECKS } from '@/modules/studio/types';

/** Derived, so adding a check cannot make the landing page lie. */
const TOTAL_CHECKS = TIER_CHECKS.LISTED.length + TIER_CHECKS.VERIFIED.length;

const SHOWCASE_STYLES: StyleTag[] = [
  'warm-modern',
  'indian-contemporary',
  'art-deco',
  'japandi',
  'industrial',
  'coastal-light',
];

export default async function LandingPage() {
  const STUDIOS = await studioRepository.list({ activeOnly: true });
  const verified = STUDIOS.filter((s) => s.tier === 'PROVEN' || s.tier === 'VERIFIED').length;
  const withRecord = STUDIOS.filter((s) => s.avgVarianceDays !== null);
  const avgVariance =
    withRecord.length > 0
      ? Math.round(
          withRecord.reduce((sum, s) => sum + (s.avgVarianceDays as number), 0) / withRecord.length,
        )
      : null;
  const completed = STUDIOS.reduce((sum, s) => sum + s.completedProjects, 0);
  const featured = [...STUDIOS]
    .filter((s) => s.tier === 'PROVEN')
    .sort((a, b) => (a.avgVarianceDays ?? 99) - (b.avgVarianceDays ?? 99))
    .slice(0, 3);

  return (
    <>
      <SiteHeader />

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden border-b border-[var(--color-rule)]">
          <div className="grid-ground grid-ground-fade absolute inset-0" aria-hidden="true" />

          <Container size="wide" className="relative">
            <div className="grid grid-cols-1 items-center gap-10 py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:py-16">
              <div>
                <div className="rise rise-1">
                  <Eyebrow>Pune · Invite-only studios</Eyebrow>
                </div>
                {/* Measure is capped so the headline breaks where it means to,
                    rather than wherever the viewport happens to run out. */}
                <h1 className="rise rise-2 display mb-6 max-w-[14ch]">
                  Verified studios, on a plan we{' '}
                  <span className="text-[var(--color-petrol)]">hold them to</span>.
                </h1>
                <p className="rise rise-3 lede mb-8">
                  Answer nine questions about your home. We match you to interior studios in Pune
                  we&rsquo;ve actually checked, show you exactly why each one fits, then set the
                  milestone plan and verify every stage against photographs from your site.
                </p>
                <div className="rise rise-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
                  <Button href="/quiz" size="lg">
                    Start — takes 3 minutes
                  </Button>
                  <span className="text-[14px] text-[var(--color-ink-3)]">
                    Free · no signup until the end
                  </span>
                </div>
              </div>

              <div className="rise rise-3 relative">
                <FloorPlan className="w-full" />
                <p className="label mt-3 text-center">3 BHK · 1,180 sq ft · typical Pune plan</p>
              </div>
            </div>
          </Container>
        </section>

        {/* ── Proof strip ── */}
        <section className="border-b border-[var(--color-rule)] bg-[var(--color-petrol-deep)] py-10 text-[var(--color-paper)]">
          <Container size="wide">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
              <ProofStat value={String(verified)} label="Studios verified" />
              <ProofStat value={String(completed)} label="Projects completed with us" />
              <ProofStat
                value={avgVariance === null ? '—' : `${avgVariance > 0 ? '+' : ''}${avgVariance}d`}
                label="Average variance to committed date"
              />
              <ProofStat value={String(TOTAL_CHECKS)} label="Checks on every studio" />
            </dl>
          </Container>
        </section>

        {/* ── Style showcase: what the quiz actually asks ── */}
        <section className="border-b border-[var(--color-rule)] py-14 sm:py-16">
          <Container size="wide">
            <div className="mb-8 max-w-[56ch]">
              <Eyebrow>Step one</Eyebrow>
              <h2 className="h2 mb-3">
                You don&rsquo;t need the vocabulary. You just need to point.
              </h2>
              <p className="m-0 text-[16px] leading-relaxed text-[var(--color-ink-2)] prose-measure">
                Most people know a room they like when they see it and have no words for why. So the
                quiz shows you rooms, not style names — and tells you what you picked afterwards,
                down to the materials.
              </p>
            </div>

            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-6">
              {SHOWCASE_STYLES.map((tag) => (
                <li key={tag} className="border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                  <StyleScene tag={tag} className="block aspect-[4/3] w-full" />
                  <div className="border-t border-[var(--color-rule)] p-2.5">
                    <p className="h3 mb-1.5 text-[13px]">{STYLE_LABELS[tag]}</p>
                    <MaterialSwatches tag={tag} className="flex-col gap-y-0.5" />
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* ── Escrow, drawn ── */}
        <section className="border-b border-[var(--color-rule)] py-14 sm:py-16">
          <Container size="wide">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <Eyebrow>How we stay involved</Eyebrow>
                <h2 className="h2 mb-5">
                  The usual complaint about interiors in India is not the design.
                </h2>
                <p className="m-0 mb-4 text-[var(--color-ink-2)]">
                  It is a project three months late. Plywood quoted, MDF delivered. An advance that
                  does not come back. Almost none of it is a matchmaking problem — it all happens
                  after the contract is signed. Which is why we don&rsquo;t hand you a phone number
                  and disappear.
                </p>
                <p className="m-0 mb-4 text-[var(--color-ink-2)]">
                  Before work starts we set the milestone plan with you and the studio, with a date
                  and a value against each stage. You pay the studio directly. At every stage they
                  upload site photographs and material invoices, and we check the work matches what
                  was quoted before you release the next payment.
                </p>
                <p className="m-0 mb-5 text-[var(--color-ink-2)]">
                  If a stage slips, it is on the record — and every delivery figure on this site is
                  built from exactly that.
                </p>
                <p className="m-0 rounded-[10px] border border-[var(--color-brass)] bg-[var(--color-brass-soft)] px-4 py-3 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
                  <strong className="text-[var(--color-ink)]">Coming next:</strong> we&rsquo;re
                  building escrow, so payments will sit with a licensed partner and release only on
                  your approval. Today we verify and hold the schedule — we do not hold your money,
                  and we won&rsquo;t say otherwise until we do.
                </p>
              </div>

              <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-6">
                <div className="mb-5 flex items-baseline justify-between gap-4">
                  <p className="m-0 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.13em] text-[var(--color-ink-3)]">
                    Example · 3 BHK, Kharadi
                  </p>
                  <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-brass)]">
                    In progress
                  </span>
                </div>
                <MilestoneTrack />
              </div>
            </div>
          </Container>
        </section>

        {/* ── Featured studios ── */}
        <section className="border-b border-[var(--color-rule)] py-14 sm:py-16">
          <Container size="wide">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-[46ch]">
                <Eyebrow>The roster</Eyebrow>
                <h2 className="h2">
                  {STUDIOS.length} studios in Pune. That is the whole list.
                </h2>
              </div>
              <Link
                href="/studios"
                className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-petrol)]"
              >
                See all {STUDIOS.length} →
              </Link>
            </div>

            <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
              {featured.map((s) => (
                <li key={s.id} className="lift border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                  <Link href={`/studios/${s.slug}`} className="block no-underline">
                    <PlanFragment
                      seed={s.id}
                      styles={s.portfolio.flatMap((p) => p.styleTags)}
                      className="block h-28 w-full"
                    />
                    <div className="border-t border-[var(--color-rule)] p-5">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h3 className="m-0 text-[16px] font-bold leading-snug text-[var(--color-ink)]">
                          {s.tradeName}
                        </h3>
                        <TierBadge tier={s.tier} />
                      </div>
                      <p className="m-0 mb-3 text-[13.5px] leading-snug text-[var(--color-ink-2)]">
                        {describeDelivery(s)}
                      </p>
                      <p className="tabular m-0 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-ink-3)]">
                        {s.minProjectPaise && s.maxProjectPaise
                          ? `${formatINRCompact(s.minProjectPaise)} – ${formatINRCompact(s.maxProjectPaise)}`
                          : ''}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* ── How it works ── */}
        <section className="border-b border-[var(--color-rule)] py-14 sm:py-16">
          <Container size="wide">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="h2 mb-9">
              Four steps, and you can stop at any of them.
            </h2>

            <ol className="m-0 grid list-none grid-cols-1 gap-0 p-0 sm:grid-cols-2 lg:grid-cols-4">
              <Step
                n="01"
                title="Tell us about your home"
                body="Nine questions — your flat, your budget, the styles you like and the ones you don't. No phone number until you have seen your matches."
              />
              <Step
                n="02"
                title="See who fits, and why"
                body="A ranked shortlist with the score broken down factor by factor, quoting your own answers back. Including the factors we could not measure."
              />
              <Step
                n="03"
                title="Check what we checked"
                body="Twelve verification checks per studio, each with its source and date. Delivery record and upheld disputes published."
              />
              <Step
                n="04"
                title="Pay against milestones"
                body="A schedule with a date and a value per stage, not a lump-sum advance. You release each payment once we've checked the work against the quote."
              />
            </ol>
          </Container>
        </section>

        {/* ── Close ── */}
        <section className="relative overflow-hidden py-16">
          <div className="grid-ground grid-ground-fade absolute inset-0" aria-hidden="true" />
          <Container size="wide" className="relative">
            <h2 className="display mb-5 max-w-[14ch]">
              Ready when you are.
            </h2>
            <p className="lede mb-8">
              Three minutes, no signup, and every answer stays changeable afterwards.
            </p>
            <Button href="/quiz" size="lg">
              Start
            </Button>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

// dt before dd in the DOM — assistive tech follows source order, not the
// visual order, so flex-col-reverse does the flipping rather than `order`.
function ProofStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse gap-1.5">
      <dt className="font-[family-name:var(--font-mono)] text-[10px] uppercase leading-snug tracking-[0.11em] opacity-70">
        {label}
      </dt>
      <dd className="tabular m-0 font-[family-name:var(--font-display)] text-[clamp(34px,5vw,46px)] leading-none">
        {value}
      </dd>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="border-t-2 border-[var(--color-petrol)] py-5 sm:pr-7">
      <span className="tabular font-[family-name:var(--font-mono)] text-[11px] tracking-[0.1em] text-[var(--color-petrol)]">
        {n}
      </span>
      <h3 className="h3 mb-2 mt-2">{title}</h3>
      <p className="m-0 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">{body}</p>
    </li>
  );
}
