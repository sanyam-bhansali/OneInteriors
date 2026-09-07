import Link from 'next/link';
import { Container, Button, Eyebrow, TierBadge } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { FloorPlan } from '@/components/art/FloorPlan';
import { MilestoneTrack } from '@/components/art/MilestoneTrack';
import { StyleScene, MaterialSwatches } from '@/components/art/StyleScene';
import { PlanFragment } from '@/components/art/PlanFragment';
import { STUDIOS } from '@/data/studios';
import { formatINRCompact } from '@/lib/money';
import { describeDelivery } from '@/modules/studio/types';
import type { StyleTag } from '@/modules/brief/types';
import { STYLE_LABELS } from '@/modules/brief/types';

const SHOWCASE_STYLES: StyleTag[] = [
  'warm-modern',
  'indian-contemporary',
  'art-deco',
  'japandi',
  'industrial',
  'coastal-light',
];

export default function LandingPage() {
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
            <div className="grid grid-cols-1 items-center gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,46%)] lg:gap-16 lg:py-20">
              <div>
                <div className="rise rise-1">
                  <Eyebrow>Pune · Invite-only studios</Eyebrow>
                </div>
                <h1 className="rise rise-2 m-0 mb-5 font-[family-name:var(--font-display)] text-[clamp(40px,8vw,74px)] font-normal leading-[0.98] tracking-[-0.018em]">
                  Your money stays put
                  <br />
                  <span className="text-[var(--color-petrol)]">until the work is right.</span>
                </h1>
                <p className="rise rise-3 m-0 mb-8 max-w-[50ch] text-[18px] leading-relaxed text-[var(--color-ink-2)]">
                  Answer nine questions about your home. We match you to verified interior studios in
                  Pune, show you exactly why each one fits, and hold every rupee in escrow until you
                  approve each stage of the work.
                </p>
                <div className="rise rise-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button href="/quiz" size="lg">
                    Start — takes 3 minutes
                  </Button>
                  <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-ink-3)]">
                    Free · No signup until the end
                  </span>
                </div>
              </div>

              <div className="rise rise-3 relative">
                <FloorPlan className="w-full" />
                <p className="mt-2 text-center font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                  3 BHK · 1,180 sq ft · typical Pune plan
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* ── Proof strip ── */}
        <section className="border-b border-[var(--color-rule)] bg-[var(--color-petrol-deep)] py-9 text-[var(--color-paper)] dark:bg-[var(--color-paper-2)] dark:text-[var(--color-ink)]">
          <Container size="wide">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
              <ProofStat value={String(verified)} label="Studios verified" />
              <ProofStat value={String(completed)} label="Projects completed through escrow" />
              <ProofStat
                value={avgVariance === null ? '—' : `${avgVariance > 0 ? '+' : ''}${avgVariance}d`}
                label="Average variance to committed date"
              />
              <ProofStat value="12" label="Checks on every studio" />
            </dl>
          </Container>
        </section>

        {/* ── Style showcase: what the quiz actually asks ── */}
        <section className="border-b border-[var(--color-rule)] py-14 sm:py-16">
          <Container size="wide">
            <div className="mb-8 max-w-[56ch]">
              <Eyebrow>Step one</Eyebrow>
              <h2 className="m-0 mb-3 font-[family-name:var(--font-display)] text-[clamp(28px,4.5vw,40px)] font-normal leading-[1.08]">
                You don&rsquo;t need the vocabulary. You just need to point.
              </h2>
              <p className="m-0 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
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
                    <p className="m-0 mb-1.5 text-[12.5px] font-bold leading-tight">
                      {STYLE_LABELS[tag]}
                    </p>
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
                <Eyebrow>Why we hold the money</Eyebrow>
                <h2 className="m-0 mb-5 font-[family-name:var(--font-display)] text-[clamp(26px,4.2vw,38px)] font-normal leading-[1.08]">
                  The usual complaint about interiors in India is not the design.
                </h2>
                <p className="m-0 mb-4 text-[var(--color-ink-2)]">
                  It is a project three months late. Plywood quoted, MDF delivered. An advance that
                  does not come back. Almost none of it is a matchmaking problem — it all happens
                  after the contract is signed.
                </p>
                <p className="m-0 mb-4 text-[var(--color-ink-2)]">
                  So we sit on the payment rail rather than beside it. Your project is split into
                  milestones. The studio uploads site photographs and material invoices when a stage
                  is done. You approve, and only then does that money move.
                </p>
                <p className="m-0 text-[var(--color-ink-2)]">
                  It is also how we can measure what actually happened — which is where every
                  delivery figure on this site comes from.
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
                <h2 className="m-0 font-[family-name:var(--font-display)] text-[clamp(26px,4.2vw,38px)] font-normal leading-[1.08]">
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
            <h2 className="m-0 mb-9 font-[family-name:var(--font-display)] text-[clamp(26px,4.2vw,38px)] font-normal leading-[1.08]">
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
                title="Pay into escrow"
                body="Milestones, not a lump-sum advance. Money releases when you approve the stage against photographs from the site."
              />
            </ol>
          </Container>
        </section>

        {/* ── Close ── */}
        <section className="relative overflow-hidden py-16">
          <div className="grid-ground grid-ground-fade absolute inset-0" aria-hidden="true" />
          <Container size="wide" className="relative">
            <h2 className="m-0 mb-4 max-w-[18ch] font-[family-name:var(--font-display)] text-[clamp(30px,5.5vw,52px)] font-normal leading-[1.02]">
              Ready when you are.
            </h2>
            <p className="m-0 mb-8 max-w-[50ch] text-[17px] text-[var(--color-ink-2)]">
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

function ProofStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dd className="tabular order-1 m-0 font-[family-name:var(--font-display)] text-[clamp(34px,5vw,46px)] leading-none">
        {value}
      </dd>
      <dt className="order-2 font-[family-name:var(--font-mono)] text-[10px] uppercase leading-snug tracking-[0.11em] opacity-70">
        {label}
      </dt>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="border-t-2 border-[var(--color-petrol)] py-5 sm:pr-7">
      <span className="tabular font-[family-name:var(--font-mono)] text-[11px] tracking-[0.1em] text-[var(--color-petrol)]">
        {n}
      </span>
      <h3 className="m-0 mb-2 mt-2 text-[16px] font-bold leading-snug">{title}</h3>
      <p className="m-0 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">{body}</p>
    </li>
  );
}
