import Link from 'next/link';
import { Container, Button, Eyebrow } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { Hero } from '@/components/Hero';
import { JOURNEY } from '@/modules/brief/journey';
import { TIER, TIERS } from '@/modules/quotation/tiers';
import { formatINRCompact } from '@/lib/money';
import { tierRangeFor } from '@/modules/quotation/tiers';
import { TIER_CHECKS } from '@/modules/studio/types';
import { rosterIsReal } from '@/lib/env';

const TOTAL_CHECKS = TIER_CHECKS.LISTED.length + TIER_CHECKS.VERIFIED.length;

/** A 2 BHK, for showing what each band costs before anyone has answered anything. */
const SAMPLE_SQFT = 850;

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative">
          <div className="absolute inset-0">
            <Hero className="h-full w-full" />
          </div>

          <Container size="wide" className="relative">
            <div className="flex min-h-[74vh] flex-col justify-end py-16 sm:min-h-[80vh] sm:py-24">
              <div className="max-w-[24ch]">
                <p className="m-0 mb-5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-white/70">
                  Pune · Interior design
                </p>
                <h1 className="m-0 mb-7 font-[family-name:var(--font-display)] text-[clamp(2.6rem,7vw,5rem)] font-normal leading-[0.98] tracking-[-0.02em] text-white">
                  The studio is the decision.
                  <br />
                  <span className="italic text-[var(--color-brass-bright)]">
                    Everything else follows it.
                  </span>
                </h1>
                <p className="m-0 mb-9 max-w-[46ch] text-[17px] leading-relaxed text-white/85 sm:text-[19px]">
                  A small roster of Pune studios we have checked ourselves. Answer nine questions,
                  see real quotes from their real rates, and talk it through with someone who has
                  read all of them.
                </p>
                <div className="flex flex-wrap items-center gap-5">
                  <Button href="/quiz" size="lg">
                    Start your brief
                  </Button>
                  <span className="text-[14.5px] text-white/70">
                    Three minutes. No sign-up to see your matches.
                  </span>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ── The journey, named ───────────────────────────── */}
        <section className="border-b border-[var(--color-rule)] bg-[var(--color-paper)] py-16 sm:py-24">
          <Container size="wide">
            <div className="mb-14 max-w-[38ch]">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="display m-0 mb-5 text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.02]">
                Six steps. You will know where you are in all of them.
              </h2>
              <p className="m-0 text-[17px] leading-relaxed text-[var(--color-ink-2)]">
                Most interior enquiries disappear into a call centre. This one does not — every
                step below happens on this site, and you can see the next one before you start.
              </p>
            </div>

            <ol className="m-0 grid list-none grid-cols-1 gap-px overflow-hidden rounded-[16px] border border-[var(--color-rule)] bg-[var(--color-rule)] p-0 md:grid-cols-2 lg:grid-cols-3">
              {JOURNEY.map((step, i) => (
                <li key={step.name} className="flex flex-col bg-[var(--color-paper-2)] p-7">
                  <div className="mb-4 flex items-baseline justify-between gap-3">
                    <span className="rounded-full bg-[var(--color-petrol)] px-3 py-1 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-paper)]">
                      {step.name}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="m-0 mb-2.5 font-[family-name:var(--font-display)] text-[21px] leading-tight text-[var(--color-ink)]">
                    {step.title}
                  </h3>
                  <p className="m-0 mb-5 flex-1 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
                    {step.body}
                  </p>
                  <p className="m-0 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-ink-3)]">
                    {step.duration}
                  </p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* ── Tiers ────────────────────────────────────────── */}
        <section className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] py-16 sm:py-24">
          <Container size="wide">
            <div className="mb-12 max-w-[42ch]">
              <Eyebrow>What you are buying</Eyebrow>
              <h2 className="display m-0 mb-5 text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.02]">
                Three bands, set by materials.
              </h2>
              <p className="m-0 text-[17px] leading-relaxed text-[var(--color-ink-2)]">
                Not a ranking of studios, and not something a studio can buy its way into. A band
                is a statement about the finish in your home — and which studios work in it comes
                from their own rate card.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {TIERS.map((tier) => {
                const definition = TIER[tier];
                const range = tierRangeFor(tier, SAMPLE_SQFT);
                return (
                  <div
                    key={tier}
                    className="flex flex-col rounded-[16px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-7"
                  >
                    <h3 className="m-0 mb-2 font-[family-name:var(--font-display)] text-[26px] leading-none text-[var(--color-ink)]">
                      {definition.label}
                    </h3>
                    <p className="m-0 mb-5 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
                      {definition.promise}
                    </p>

                    <p className="m-0 mb-1 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                      A 2 BHK, {SAMPLE_SQFT} sqft
                    </p>
                    <p className="m-0 mb-6 font-[family-name:var(--font-display)] text-[24px] leading-none text-[var(--color-petrol)]">
                      {formatINRCompact(range.lowPaise)} – {formatINRCompact(range.highPaise)}
                    </p>

                    <ul className="m-0 mb-6 flex flex-1 list-none flex-col gap-2 p-0">
                      {definition.materials.map((m) => (
                        <li
                          key={m}
                          className="grid grid-cols-[14px_minmax(0,1fr)] gap-2.5 text-[14px] leading-snug text-[var(--color-ink-2)]"
                        >
                          <span aria-hidden="true" className="text-[var(--color-brass)]">
                            ·
                          </span>
                          {m}
                        </li>
                      ))}
                    </ul>

                    {/* The thing that makes the other three lines believable. */}
                    <p className="m-0 border-t border-[var(--color-rule)] pt-4 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
                      {definition.notFor}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="m-0 mt-8 max-w-[64ch] text-[14px] leading-relaxed text-[var(--color-ink-3)]">
              Ranges exclude GST and assume a typical 2 BHK. Your own numbers arrive after the
              brief, priced by each studio from their own rates — these are here so you can see
              whether a band is in reach before spending any more time on it.
            </p>
          </Container>
        </section>

        {/* ── The promise ──────────────────────────────────── */}
        <section className="border-b border-[var(--color-rule)] py-16 sm:py-20">
          <Container size="wide">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
              <Promise
                n="01"
                title={`${TOTAL_CHECKS} checks before a studio appears`}
                body="Identity, GST filing history, references we call ourselves, and two completed sites we visit in person. A studio cannot pay to skip any of it."
                href="/verification"
                linkLabel="How we verify"
              />
              <Promise
                n="02"
                title="We publish the bad numbers too"
                body="Average days past a studio's own committed date, and any dispute upheld against them. It cuts both ways, which is exactly why the good numbers mean something."
              />
              <Promise
                n="03"
                title="We do not hold your money"
                body="You pay the studio directly, against a milestone plan we set and check. No escrow yet — and we would rather say so than imply a protection that does not exist."
              />
            </div>
          </Container>
        </section>

        {/* ── Close ────────────────────────────────────────── */}
        <section className="py-16 sm:py-24">
          <Container size="narrow">
            <div className="text-center">
              <h2 className="display m-0 mb-5 text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.05]">
                Start with the nine questions.
              </h2>
              <p className="m-0 mb-8 text-[17px] leading-relaxed text-[var(--color-ink-2)]">
                You will see your matches and your quotes before we ask for anything. If none of it
                is useful, you have lost three minutes.
              </p>
              <Button href="/quiz" size="lg">
                Start your brief
              </Button>
              <p className="m-0 mt-6 text-[14px] text-[var(--color-ink-3)]">
                Already started?{' '}
                <Link href="/sign-in" className="text-[var(--color-petrol)]">
                  Sign in to pick it up
                </Link>
                .
              </p>
            </div>
          </Container>
        </section>

        {!rosterIsReal() ? (
          <Container size="wide">
            <p className="m-0 mb-12 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-4 text-[13px] leading-relaxed text-[var(--color-ink-3)]">
              Pre-launch build. The studios shown are placeholder records used to develop and
              review the product — they are not real businesses and the registration numbers are
              not real.
            </p>
          </Container>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}

function Promise({
  n,
  title,
  body,
  href,
  linkLabel,
}: {
  n: string;
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="border-t-2 border-[var(--color-petrol)] pt-5">
      <p className="m-0 mb-3 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.12em] text-[var(--color-petrol)]">
        {n}
      </p>
      <h3 className="m-0 mb-2.5 font-[family-name:var(--font-display)] text-[21px] leading-tight text-[var(--color-ink)]">
        {title}
      </h3>
      <p className="m-0 text-[15px] leading-relaxed text-[var(--color-ink-2)]">{body}</p>
      {href && linkLabel ? (
        <Link
          href={href}
          className="mt-3 inline-block text-[14.5px] text-[var(--color-petrol)] no-underline hover:underline"
        >
          {linkLabel} →
        </Link>
      ) : null}
    </div>
  );
}
