import Link from 'next/link';
import type { Metadata } from 'next';
import { formatINRCompact } from '@/lib/money';
import { TIER, TIERS, tierRangeFor } from '@/modules/quotation/tiers';
import { Mark } from '@/components/brand';
import { Wrap, Section, Eyebrow, Heading, Cta, Stat, Tick, PlayIcon } from '@/components/landing/parts';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Testimonials, Faq } from '@/components/landing/Interactive';
import { Problem } from '@/components/landing/Problem';
import { Trust } from '@/components/landing/Trust';
import { Walkthrough } from '@/components/landing/Walkthrough';
import { Portfolio } from '@/components/landing/Portfolio';
import { HeroShowreel } from '@/components/landing/HeroShowreel';

export const metadata: Metadata = {
  title: 'One Interiors — verified interior studios in Pune',
  description:
    'Nine questions about your flat. Three studios matched to the answers. A first quote priced in three seconds, and an architect of your own while you compare.',
};

/**
 * The landing page, built to the locked "Tactile Assurance" design system.
 *
 * ## The one wording rule, and why it is not a detail
 *
 * Every call to action on this page says **find** or **get**, never
 * **request**. The design system states it plainly: the first quote is generated from
 * the studio's own filed rate card in about three seconds — no studio is
 * asked, nobody is phoned — and it must never be described as requesting a
 * quote.
 *
 * That is not pedantry about a verb. "Request a quote" is the exact phrase
 * every lead-generation site in this category uses, and to a Pune homeowner who
 * has used two of them it means *my number is about to be passed to people who
 * will ring me*. It gives away the single thing this product does differently,
 * in the first four words anybody reads.
 *
 * ## Tokens
 *
 * Everything below sits inside `.oi-landing`, which is where the locked
 * palette lives. It is scoped rather than global because the quiz, the match
 * screens, the ops console and the studio software are all on the older
 * paper/petrol tokens; repainting them from here would be a redesign of eleven
 * surfaces disguised as a landing-page change. See `globals.css`.
 *
 * ## Photography
 *
 * Every image is licensed stock standing in for real project work, and the
 * hero is a still where a film belongs. Both carry an expiry — see
 * `src/lib/imagery.ts`. Replace before launch.
 */

const NAV = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#portfolio', label: 'Portfolio' },
  { href: '#packages', label: 'Packages' },
  { href: '#trust', label: 'Why trust us' },
];

/**
 * The bands, read from the pricing engine rather than retyped.
 *
 * They used to be a hard-coded array on this page with its own ranges and its
 * own materials, and it had already drifted: the page advertised
 * "₹5.9–9 L / ₹9–16 L / ₹16–27 L" while `tiers.ts` — the file the quiz and
 * every quote actually price against — put Essential at ₹700–1,100 per sq ft,
 * which for the 1,180 sq ft the page names is ₹8.3–13 L. A visitor who read
 * the band here and then took the quiz got a different number for the same
 * flat, and there is no reading of that which is not us being wrong on the
 * page that promises we are not.
 *
 * So the figures come from `TIER` and the range from `tierRangeFor`, which
 * means a change to pricing cannot leave the marketing behind.
 */
const SAMPLE_SQFT = 1180;

const PACKAGES = TIERS.map((tier) => {
  const band = TIER[tier];
  const { lowPaise, highPaise } = tierRangeFor(tier, SAMPLE_SQFT);

  return {
    tier,
    name: band.label,
    perSqft: `₹${band.perSqftFrom.toLocaleString('en-IN')}–${band.perSqftTo.toLocaleString('en-IN')}`,
    range: `${formatINRCompact(lowPaise)}–${formatINRCompact(highPaise)}`,
    promise: band.promise,
    materials: band.materials,
    // `notFor` in `tiers.ts` is two sentences: what the band is not for, and
    // what to do instead. The card has room for the first, which is the part
    // that stops somebody buying the wrong band.
    //
    // The leading "Not the band for" is stripped because the card already
    // says "Not this band if" — left in, it rendered as "NOT THIS BAND IF —
    // NOT THE BAND FOR VENEER…", which is the same negation twice and reads
    // like a mistake. Derived rather than retyped, so the warning cannot
    // drift from the one the quiz shows.
    notFor: `${band.notFor.split('. ')[0]!.replace(/^Not the band for /, 'you want ')}.`,
    featured: tier === 'PREMIUM',
  };
});


export default function HomePage() {
  return (
    // `relative` matters. The nav below is absolutely positioned, and the root
    // layout renders the pre-launch roster banner above this page — without a
    // positioning context here the nav would resolve against the document and
    // sit on top of that banner.
    <div className="oi-landing relative">
      {/* ── Nav ── */}
      <header className="absolute inset-x-0 top-0 z-30">
        <Wrap>
          <div className="flex items-center justify-between gap-6 py-5">
            <Link href="/" className="flex items-center gap-2.5 no-underline" aria-label="One Interiors, home">
              <Mark className="h-5 w-5 text-white" />
              <span className="oi-display text-[19px] leading-tight text-white">One Interiors</span>
              <span className="oi-num ml-1 hidden text-[10px] uppercase tracking-[0.18em] text-white/60 sm:inline">
                Pune
              </span>
            </Link>

            <nav className="hidden items-center gap-7 lg:flex">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-[14px] text-white/75 no-underline transition-colors hover:text-white"
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/expert"
                className="border-b border-white/40 pb-0.5 text-[14px] text-white no-underline transition-colors hover:border-white"
              >
                Talk to an architect
              </Link>
            </nav>

            {/* "Find", never "request". See the note at the top of this file. */}
            <Cta href="/quiz" className="!px-5 !py-2.5 !text-[13.5px]">
              Find your designer
            </Cta>
          </div>
        </Wrap>
      </header>

      {/* ── Hero ── */}
      <section className="relative">
        <div className="relative min-h-[max(600px,80vh)] w-full overflow-hidden">
          <HeroShowreel />

          {/* The opening beat.
              `aria-hidden` and `pointer-events-none`: it is a decoration, the
              name is already in the nav and the H1 is already in the DOM, so
              a screen reader announcing this would just be reading the brand
              name twice before getting to the headline. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="hero-wordmark oi-display text-[clamp(2.4rem,1.2rem+4.6vw,4.6rem)] text-white/95">
              One Interiors
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0">
            <Wrap className="hero-copy pb-11 sm:pb-14">
              {/* Contrast: this eyebrow sat over a plant at 40% opacity in
                  review and could not be read. It is on the scrim now. */}
              <p className="oi-num m-0 mb-5 text-[10.5px] uppercase tracking-[0.2em] text-white/80">
                Pune · 6,000 studios screened, 14 listed
              </p>

              <h1 className="oi-display m-0 mb-4 max-w-[19ch] text-[clamp(2rem,1.3rem+3vw,3.4rem)] text-white">
                Find the right interior designer for your home.
              </h1>

              <p className="m-0 mb-8 max-w-[52ch] text-[16px] leading-[1.6] text-white/85">
                Answer nine questions about your flat. We match you with studios that actually fit
                it, price the first quote off their own rate card, and give you a personal architect
                to check every step.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Cta href="/quiz">Find your interior designer</Cta>
                <a
                  href="#walkthrough"
                  className="inline-flex items-center gap-2.5 border border-white/30 px-5 py-3.5 text-[14px] text-white no-underline transition-colors hover:border-white/70"
                >
                  <PlayIcon />
                  See how it works
                </a>
              </div>
            </Wrap>
          </div>

        </div>
      </section>

      {/* ── Reviews strip ──
          Four cells. The quote range that used to sit in the third —
          "₹5.95 L–₹27.2 L, range of quotes compared here" — is gone and must
          not come back on this page: a price band stated before anybody has
          said how big their flat is invites exactly the reading the Packages
          section exists to prevent, and the page now makes the per-sq-ft
          argument properly further down.

          The fourth cell is a claim rather than a measurement, which is why
          it carries a tick instead of a figure — it reads as the terms of the
          offer, not as a fourth statistic with a number missing.

          The rating is real client data from a listed studio's own finished
          projects, which is why it is labelled as one studio's record rather
          than a site-wide average. One Interiors has not delivered 41
          projects and the strip must not imply that it has. */}
      <Section className="border-y border-[var(--line)] bg-[var(--card)]">
        <Wrap>
          <div className="grid divide-y divide-[var(--line)] sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
            <Stat
              figure="4.8"
              unit="/ 5"
              label="from 41 clients who finished a project"
              source="One listed studio’s own record"
            />
            <Stat figure="68" label="briefs matched to Pune studios" />
            <Stat figure="6,000 → 14" label="Pune studios screened, currently listed" />

            <div className="flex flex-col gap-1.5 px-5 py-7 sm:px-8">
              <p className="m-0 flex items-center gap-2" style={{ color: 'var(--sec)' }}>
                <Tick />
                <span className="text-[15px] font-medium text-[var(--ink)]">Free until you book</span>
              </p>
              <p className="m-0 text-[13.5px] leading-snug text-[var(--ink2)]">
                studios pay us, never you
              </p>
            </div>
          </div>
        </Wrap>
      </Section>

      {/* ── Problem — the evidence board ── */}
      <Problem />

      {/* ── How it works — the pinned spine ── */}
      <HowItWorks />

      {/* ── Why trust us — the fifteen checks ── */}
      <Trust />

      {/* ── The product, step by step ──
          This replaces the "90-second film" band, which was a play
          button over a photograph for a film that does not exist. */}
      <Walkthrough />

      {/* ── Voices ── */}
      <Testimonials />

      {/* ── Portfolio ── */}
      <Portfolio />

      {/* ── Packages ──
          Alabaster section, Raw Silk cards: the inversion of every other
          band on the page, so a card reads as a thing sitting on a surface
          rather than a panel cut out of it. */}
      <section
        id="packages"
        className="border-t border-[var(--line)] bg-[var(--card)] py-16 sm:py-20"
      >
        <Wrap>
          <Eyebrow>Packages</Eyebrow>

          {/* The pricing basis sits on the heading row rather than stacked
              under it. Two mono lines stacked under a mono eyebrow flattened
              the hierarchy into three grey labels in a column. */}
          <div className="mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
            <Heading className="max-w-[24ch]">
              Three bands, described in materials rather than adjectives.
            </Heading>
            <div className="text-left sm:text-right">
              <p className="oi-label m-0">All-in, per sq ft of carpet area</p>
              <p className="oi-label m-0 mt-0.5 !text-[var(--ink2)]/70">
                The quiz re-costs it for your flat
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {PACKAGES.map((band) => (
              <article
                key={band.tier}
                className="relative flex flex-col bg-[var(--bg)] p-6"
                style={{
                  border: band.featured ? '1.5px solid var(--acc)' : '1px solid var(--line)',
                }}
              >
                {band.featured ? (
                  // `whitespace-nowrap`: at the narrowest card width this tab
                  // wrapped to two lines and pushed itself off the top edge.
                  <span
                    className="oi-num absolute right-6 top-[-1px] whitespace-nowrap px-3 py-1 text-[9.5px] uppercase tracking-[0.16em] text-white"
                    style={{ background: 'var(--acc-btn)' }}
                  >
                    Most compared
                  </span>
                ) : null}

                <p className="oi-label m-0 mb-4">{band.name}</p>

                <p className="oi-num m-0 text-[26px] leading-none">
                  {band.perSqft}
                  <span className="text-[13px] text-[var(--ink2)]"> / sq ft</span>
                </p>
                <p className="oi-num m-0 mb-4 mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--ink2)]">
                  {band.range} for {SAMPLE_SQFT.toLocaleString('en-IN')} sq ft
                </p>

                <p className="m-0 mb-6 min-h-[3.2em] text-[14.5px] leading-[1.55] text-[var(--ink2)]">
                  {band.promise}
                </p>

                <ul className="m-0 mb-6 flex list-none flex-col gap-2.5 border-b border-[var(--line)] p-0 pb-6">
                  {band.materials.map((material) => (
                    <li key={material} className="flex items-start gap-2.5">
                      <Tick className="mt-0.5" style={{ color: 'var(--sec)' }} />
                      <span className="text-[13.5px] leading-[1.5]">{material}</span>
                    </li>
                  ))}
                </ul>

                {/* Terracotta, because this is an attention flag — the one
                    line on the card that stops somebody buying the wrong
                    band. It is not an action, so it is not a button. */}
                <p
                  className="oi-num m-0 mb-6 text-[9.5px] uppercase leading-[1.6] tracking-[0.14em]"
                  style={{ color: 'var(--acc-ink)', whiteSpace: 'normal' }}
                >
                  Not this band if — {band.notFor}
                </p>

                <Cta
                  href="/quiz"
                  intent={band.featured ? 'quote' : 'quiet'}
                  className="mt-auto w-full"
                >
                  Get this quoted
                </Cta>
              </article>
            ))}
          </div>
        </Wrap>
      </section>

      {/* ── FAQ ── */}
      <Faq />

      {/* ── Closing ── */}
      <section style={{ background: 'var(--acc)' }} className="py-16 sm:py-20">
        <Wrap>
          {/* Copy left, actions right. Stacked, the two buttons sat under a
              short paragraph on a wide terracotta field with nothing on the
              right half of the band at all. */}
          <div className="flex flex-wrap items-center justify-between gap-x-12 gap-y-7">
            <div>
              <h2 className="oi-display m-0 mb-3 max-w-[24ch] text-[clamp(1.6rem,1.15rem+1.8vw,2.4rem)] text-white">
                Nine questions. Then a quote you can actually read.
              </h2>
              <p className="m-0 max-w-[56ch] text-[15.5px] leading-[1.6] text-white/85">
                Two minutes, no phone call, and nothing payable by you at any point.
              </p>
            </div>

            <div className="flex flex-none flex-wrap gap-3">
              <Cta href="/quiz" intent="onAccent">
                Start the quiz
              </Cta>
              <Cta href="/expert" intent="onDark">
                Talk to an architect first
              </Cta>
            </div>
          </div>
        </Wrap>
      </section>

      {/* ── Footer ── */}
      <Section dark className="py-16">
        <Wrap>
          {/* Four columns: brand, the product, for studios, talk to us.
              Contact was inside the brand column, which made the first column
              twice the height of the other two and left the row lopsided. */}
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.1fr]">
            <div>
              <span className="mb-4 flex items-center gap-2.5">
                <Mark className="h-5 w-5 text-white/80" />
                <span className="oi-display text-[19px] text-[#f4efe8]">One Interiors</span>
              </span>
              <p className="m-0 max-w-[34ch] text-[13.5px] leading-[1.6] text-white/60">
                Interior studios in Pune, checked fifteen ways and quoted line by line.
              </p>
            </div>

            <nav className="flex flex-col gap-2.5">
              <p className="oi-num m-0 mb-1 text-[10px] uppercase tracking-[0.16em] text-white/45">
                The product
              </p>
              {[
                ['#how-it-works', 'How it works'],
                ['#portfolio', 'Portfolio'],
                ['#packages', 'Packages'],
                ['#faq', 'FAQ'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="text-[14px] text-white/70 no-underline hover:text-white"
                >
                  {label}
                </a>
              ))}
            </nav>

            <nav className="flex flex-col gap-2.5">
              <p className="oi-num m-0 mb-1 text-[10px] uppercase tracking-[0.16em] text-white/45">
                For studios
              </p>
              {[
                ['/apply', 'Apply to be listed'],
                ['/verification', 'The fifteen checks'],
                ['/apply', 'Filing your rate card'],
                ['/apply', 'How we are paid'],
              ].map(([href, label], i) => (
                <Link
                  key={`${href}-${i}`}
                  href={href!}
                  className="text-[14px] text-white/70 no-underline hover:text-white"
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="flex flex-col gap-2.5">
              <p className="oi-num m-0 mb-1 text-[10px] uppercase tracking-[0.16em] text-white/45">
                Talk to us
              </p>
              <a
                href="mailto:hello@oneinteriors.in"
                className="text-[14px] text-white/70 no-underline hover:text-white"
              >
                hello@oneinteriors.in
              </a>
              <a
                href="tel:+912040000000"
                className="oi-num text-[14px] text-white/70 no-underline hover:text-white"
              >
                +91 20 4000 0000
              </a>
              <p className="oi-num m-0 mt-1 text-[10px] uppercase tracking-[0.16em] text-white/40">
                Mon–Sat · 10:00–19:00 IST
              </p>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/12 pt-6">
            <p className="oi-num m-0 text-[10px] uppercase tracking-[0.16em] text-white/40">
              © 2026 One Interiors · Pune, Maharashtra
            </p>
            {/* These three routes do not exist yet. Linked because the page is
                the spec for them and a footer without them reads as a company
                that has not thought about consent — but `/privacy` in
                particular is overdue: `consent/policy.ts` already stamps every
                consent row with POLICY_VERSION '2026-09-01', and that version
                currently points at no page at all. */}
            <div className="flex gap-6">
              {['Privacy', 'Terms', 'How we use your brief'].map((label) => (
                <span key={label} className="text-[13px] text-white/40">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </Wrap>
      </Section>
    </div>
  );
}
