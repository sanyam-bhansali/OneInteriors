import Link from 'next/link';
import Image from 'next/image';
import { Container } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { JOURNEY } from '@/modules/brief/journey';
import { TIER, TIERS, tierRangeFor } from '@/modules/quotation/tiers';
import { formatINRCompact } from '@/lib/money';
import { PHOTOS } from '@/lib/imagery';
import { TIER_CHECKS } from '@/modules/studio/types';
import { rosterIsReal } from '@/lib/env';
import { StartCta } from '@/components/StartCta';

const TOTAL_CHECKS = TIER_CHECKS.LISTED.length + TIER_CHECKS.VERIFIED.length;
const SAMPLE_SQFT = 850;

const TIER_PHOTO = {
  ESSENTIAL: PHOTOS.essential,
  PREMIUM: PHOTOS.premium,
  LUXURY: PHOTOS.luxury,
} as const;

/**
 * The landing page.
 *
 * ## What this page has to do, in order
 *
 * A person arriving here is about to spend several lakh rupees with a stranger,
 * and the thing they are actually feeling is **fear of being cheated** — the
 * complaint corpus for this category is almost entirely about that, not about
 * taste. So the page is ordered to answer fear before it sells anything:
 *
 *  1. **A finished room, immediately.** Not a promise, a result. This is the
 *     only emotional beat, and it goes first because someone who feels nothing
 *     will not read the argument.
 *  2. **What actually happens, named and numbered.** Uncertainty is the fear.
 *     Six named steps with honest durations turn an unknown process into a
 *     known one, and naming them gives the reader words to describe it to a
 *     spouse who was not here.
 *  3. **Price, before they have to ask.** Not knowing what something costs is
 *     the second fear, and every competitor makes you fill in a form to find
 *     out. Showing three real bands for a real flat size removes the whole
 *     "am I about to be quoted a silly number" question.
 *  4. **What we refuse to do.** The trust section is deliberately made of
 *     things that cost us something — we publish the bad numbers, we do not
 *     hold the money. Claims that cost nothing to make are read, correctly, as
 *     worthless.
 *
 * ## Typography
 *
 * A long headline set at display size in a narrow column wraps to two or three
 * words a line and reads as broken — which is what the first build of this
 * page did. So the display line is short enough to hold together, measures are
 * set in rem rather than `ch` (a `ch` at 80px is enormous and silently
 * overflows the container), and every long paragraph is capped near 62
 * characters, which is where reading speed peaks.
 */
export default function Home() {
  return (
    <>
      <SiteHeader />

      <main>
        {/* ── Hero ───────────────────────────────────────────
            Split rather than text-on-photo. Interior photography is light and
            warm; white text over it needs a scrim heavy enough to ruin the
            room, which defeats the point of leading with a room. */}
        <section className="border-b border-[var(--color-rule)]">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="flex items-center bg-[var(--color-paper)] px-6 py-14 sm:px-10 sm:py-20 lg:py-28 lg:pl-[max(2.5rem,calc((100vw-72rem)/2+1.5rem))] lg:pr-14">
              <div className="w-full max-w-[34rem]">
                <p className="m-0 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
                  Pune · Interior design
                </p>

                <h1
                  className="m-0 mb-6 font-[family-name:var(--font-display)] text-[clamp(2.5rem,5.2vw,4rem)] font-normal leading-[1.02] tracking-[-0.02em] text-[var(--color-ink)]"
                  style={{ textWrap: 'balance' }}
                >
                  Know what your home costs
                  <br />
                  <span className="italic text-[var(--color-petrol)]">before anyone visits.</span>
                </h1>

                <p className="m-0 mb-8 max-w-[36rem] text-[17px] leading-[1.65] text-[var(--color-ink-2)] sm:text-[18px]">
                  Answer nine questions and get real quotes from real Pune studios, side by side,
                  in one afternoon. No site visits, no salespeople, no giving your number to six
                  companies to find out a price.
                </p>

                <div className="mb-9 flex flex-wrap items-center gap-4">
                  {/* Resumes if this browser already has a brief. A returning
                      visitor clicking "Get my quotes" and landing on question
                      one reads as the product having forgotten them. */}
                  <StartCta fallbackNote="Three minutes · no sign-up to see your matches" />
                </div>

                {/* The trust strip. Facts with numbers in them, immediately
                    under the button, because this is the moment of hesitation. */}
                <ul className="m-0 flex list-none flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-rule)] p-0 pt-6">
                  <TrustFact figure="3 min" label="to your first number" />
                  <TrustFact figure="0" label="calls before you see prices" />
                  <TrustFact figure="0%" label="added to any quote" />
                </ul>
              </div>
            </div>

            <div className="relative min-h-[22rem] lg:min-h-[38rem]">
              <Image
                src={PHOTOS.hero.src}
                alt={PHOTOS.hero.alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 52vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* ── The journey ───────────────────────────────── */}
        <section className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] py-16 sm:py-24">
          <Container size="wide">
            <div className="mb-12 max-w-[44rem]">
              <p className="m-0 mb-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
                How it works
              </p>
              <h2
                className="m-0 mb-5 font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3rem)] font-normal leading-[1.06] tracking-[-0.018em] text-[var(--color-ink)]"
                style={{ textWrap: 'balance' }}
              >
                You will never wonder what happens next.
              </h2>
              <p className="m-0 max-w-[62ch] text-[17px] leading-[1.65] text-[var(--color-ink-2)]">                Every other enquiry you send today disappears into a call centre and comes back as a
                salesperson. Here you can read all six steps before you start one of them.
              </p>
            </div>

            <ol className="m-0 grid list-none grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-rule)] p-0 md:grid-cols-2 lg:grid-cols-3">
              {JOURNEY.map((step, i) => (
                <li key={step.name} className="flex flex-col bg-[var(--color-paper)] p-7">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.13em] text-[var(--color-petrol)]">
                      {step.name}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--color-rule)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="m-0 mb-2.5 font-[family-name:var(--font-display)] text-[22px] font-normal leading-[1.2] text-[var(--color-ink)]">
                    {step.title}
                  </h3>
                  <p className="m-0 mb-6 flex-1 text-[14.5px] leading-[1.6] text-[var(--color-ink-2)]">
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

        {/* ── Tiers ─────────────────────────────────────── */}
        <section className="border-b border-[var(--color-rule)] py-16 sm:py-24">
          <Container size="wide">
            <div className="mb-12 max-w-[44rem]">
              <p className="m-0 mb-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
                What things cost
              </p>
              <h2
                className="m-0 mb-5 font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3rem)] font-normal leading-[1.06] tracking-[-0.018em] text-[var(--color-ink)]"
                style={{ textWrap: 'balance' }}
              >                What your flat actually costs, in plain numbers.
              </h2>
              <p className="m-0 max-w-[62ch] text-[17px] leading-[1.65] text-[var(--color-ink-2)]">                Most people have no idea whether their budget is realistic until someone has been to
                their home and quoted them. Here is the honest range for a typical 2 BHK at three
                levels of finish, so you know where you stand today.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {TIERS.map((tier) => {
                const definition = TIER[tier];
                const range = tierRangeFor(tier, SAMPLE_SQFT);
                const photo = TIER_PHOTO[tier];

                return (
                  <article
                    key={tier}
                    className="flex flex-col overflow-hidden rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]"
                  >
                    <div className="relative h-44">
                      <Image
                        src={photo.src}
                        alt={photo.alt}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                    </div>

                    <div className="flex flex-1 flex-col p-7">
                      <h3 className="m-0 mb-2 font-[family-name:var(--font-display)] text-[26px] font-normal leading-none text-[var(--color-ink)]">
                        {definition.label}
                      </h3>
                      <p className="m-0 mb-6 text-[15px] leading-[1.6] text-[var(--color-ink-2)]">
                        {definition.promise}
                      </p>

                      <p className="m-0 mb-1 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                        2 BHK · {SAMPLE_SQFT} sqft
                      </p>
                      <p className="m-0 mb-6 font-[family-name:var(--font-display)] text-[26px] leading-none text-[var(--color-petrol)]">
                        {formatINRCompact(range.lowPaise)}
                        <span className="text-[var(--color-ink-3)]"> – </span>
                        {formatINRCompact(range.highPaise)}
                      </p>

                      <ul className="m-0 mb-6 flex flex-1 list-none flex-col gap-2 p-0">
                        {definition.materials.map((m) => (
                          <li
                            key={m}
                            className="grid grid-cols-[12px_minmax(0,1fr)] gap-2.5 text-[14px] leading-[1.5] text-[var(--color-ink-2)]"
                          >
                            <span aria-hidden="true" className="text-[var(--color-brass)]">
                              ·
                            </span>
                            {m}
                          </li>
                        ))}
                      </ul>

                      {/* The line that makes the four above it believable. */}
                      <p className="m-0 border-t border-[var(--color-rule)] pt-4 text-[13.5px] leading-[1.55] text-[var(--color-ink-3)]">
                        {definition.notFor}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>

            <p className="m-0 mt-8 max-w-[62ch] text-[14px] leading-[1.6] text-[var(--color-ink-3)]">
              Excluding GST, for a typical 2 BHK. Your own numbers come after the brief, priced by
              each studio from their own rates.
            </p>
          </Container>
        </section>

        {/* ── Trust ─────────────────────────────────────── */}
        <section className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] py-16 sm:py-24">
          <Container size="wide">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="relative order-2 h-[22rem] overflow-hidden rounded-[14px] lg:order-1 lg:h-[28rem]">
                <Image
                  src={PHOTOS.verification.src}
                  alt={PHOTOS.verification.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>

              <div className="order-1 lg:order-2">
                <p className="m-0 mb-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
                  Why this is different
                </p>
                <h2
                  className="m-0 mb-6 font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3rem)] font-normal leading-[1.06] tracking-[-0.018em] text-[var(--color-ink)]"
                  style={{ textWrap: 'balance' }}
                >                  Why you can believe the number.
                </h2>
                <p className="m-0 mb-9 max-w-[58ch] text-[16.5px] leading-[1.65] text-[var(--color-ink-2)]">                  A quote is only worth what the company behind it is worth. Here is what we do before
                  a studio is allowed to send you one.
                </p>

                <div className="flex flex-col gap-8">
                  <PromiseRow
                    n="01"
                    title="Somebody has actually been to their sites"
                    body={`We run ${TOTAL_CHECKS} checks before a studio appears — GST filings, references we telephone ourselves, and two finished homes we walk through. No studio can pay to skip one.`}
                    href="/verification"
                    linkLabel="What we check"
                  />
                  <PromiseRow
                    n="02"
                    title="You can see how late they usually run"
                    body="Every studio's profile carries the days they typically run past their own committed date, and any dispute upheld against them. Nobody else will show you that."
                  />
                  <PromiseRow
                    n="03"
                    title="Your money never passes through us"
                    body="You pay the studio directly, against a milestone plan we set and check. We are not holding your deposit, and we would rather say so than imply a protection you do not have."
                  />
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ── Expert ────────────────────────────────────── */}
        <section className="border-b border-[var(--color-rule)] py-16 sm:py-24">
          <Container size="wide">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
              <div>
                <p className="m-0 mb-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
                  OneExpert
                </p>
                <h2
                  className="m-0 mb-6 font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3rem)] font-normal leading-[1.06] tracking-[-0.018em] text-[var(--color-ink)]"
                  style={{ textWrap: 'balance' }}
                >                  Then talk to someone who has no stake in your answer.
                </h2>
                <p className="m-0 mb-5 max-w-[58ch] text-[16.5px] leading-[1.65] text-[var(--color-ink-2)]">                  Once you have your quotes, pick the studios you want to discuss and we will call you.
                  Whoever you speak to has already read your brief, your floor plan and every quote
                  in front of you — you will not be explaining your flat again.
                </p>
                <p className="m-0 max-w-[58ch] text-[16.5px] leading-[1.65] text-[var(--color-ink-2)]">
                  Then we set up the meeting with whichever one you choose. Free, and there is
                  nothing to buy on the call — which is why we can tell you when none of them is
                  right for you.
                </p>
              </div>

              <div className="relative h-[20rem] overflow-hidden rounded-[14px] lg:h-[26rem]">
                <Image
                  src={PHOTOS.expert.src}
                  alt={PHOTOS.expert.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                />
              </div>
            </div>
          </Container>
        </section>

        {/* ── Close ─────────────────────────────────────── */}
        <section className="py-16 sm:py-24">
          <Container size="narrow">
            <div className="text-center">
              <h2
                className="m-0 mb-5 font-[family-name:var(--font-display)] text-[clamp(1.9rem,3.6vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.018em] text-[var(--color-ink)]"
                style={{ textWrap: 'balance' }}
              >                Find out what your home costs.
              </h2>
              <p className="mx-auto m-0 mb-8 max-w-[46ch] text-[17px] leading-[1.65] text-[var(--color-ink-2)]">                Nine questions, three minutes, and you will have real numbers from real studios. If
                none of it is useful, you have lost an afternoon coffee&rsquo;s worth of time.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <StartCta />
              </div>
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
            <p className="m-0 mb-12 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-4 text-[13px] leading-[1.6] text-[var(--color-ink-3)]">
              Pre-launch build. The studios shown are placeholder records used to develop the
              product — they are not real businesses. Photography on this page is stock, and will
              be replaced with the studios&rsquo; own completed work before launch.
            </p>
          </Container>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}

function TrustFact({ figure, label }: { figure: string; label: string }) {
  return (
    <li>
      <span className="block font-[family-name:var(--font-display)] text-[26px] leading-none text-[var(--color-ink)]">
        {figure}
      </span>
      <span className="mt-1 block text-[13px] leading-snug text-[var(--color-ink-3)]">{label}</span>
    </li>
  );
}

function PromiseRow({
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
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-4">
      <span className="pt-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--color-brass)]">
        {n}
      </span>
      <div>
        <h3 className="m-0 mb-2 font-[family-name:var(--font-display)] text-[21px] font-normal leading-[1.2] text-[var(--color-ink)]">
          {title}
        </h3>
        <p className="m-0 max-w-[52ch] text-[15px] leading-[1.6] text-[var(--color-ink-2)]">
          {body}
        </p>
        {href && linkLabel ? (
          <Link
            href={href}
            className="mt-2.5 inline-block text-[14px] text-[var(--color-petrol)] no-underline hover:underline"
          >
            {linkLabel} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
