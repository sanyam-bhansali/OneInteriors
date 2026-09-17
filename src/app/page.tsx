import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { PHOTOS } from '@/lib/imagery';
import { Mark } from '@/components/brand';
import { Wrap, Section, Eyebrow, Heading, Cta, Stat, SpecRow, PlayIcon } from '@/components/landing/parts';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Portfolio, Testimonials, Faq } from '@/components/landing/Interactive';

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
 * Every call to action on this page says **get** a quote, never **request**
 * one. The design system states it plainly: the first quote is generated from
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

const PACKAGES = [
  {
    name: 'Essential',
    range: '₹5.9–9 L',
    promise: 'Everything a flat needs to be lived in, nothing it doesn’t.',
    specs: [
      ['Carcass', '16MM MDF'],
      ['Shutters', 'MATT LAMINATE'],
      ['Hardware', 'STANDARD · 2 YR'],
      ['Ceiling', 'PERIPHERAL ONLY'],
    ],
    featured: false,
  },
  {
    name: 'Premium',
    range: '₹9–16 L',
    promise: 'Where most Pune 2 BHKs land once the kitchen is taken seriously.',
    specs: [
      ['Carcass', '18MM BWP'],
      ['Shutters', 'VENEER + LAMINATE'],
      ['Hardware', 'BRANDED · 10 YR'],
      ['Ceiling', 'DESIGNED · 3 CIRCUITS'],
    ],
    featured: true,
  },
  {
    name: 'Luxury',
    range: '₹16–27 L',
    promise: 'Custom joinery, stone, and a site that runs for four to five months.',
    specs: [
      ['Carcass', '18MM BWP · MARINE'],
      ['Shutters', 'TEAK · ACRYLIC · GLASS'],
      ['Hardware', 'IMPORTED · LIFETIME'],
      ['Ceiling', 'LAYERED · 5 CIRCUITS'],
    ],
    featured: false,
  },
];

const CHECKS = [
  {
    n: '01',
    group: 'Identity',
    title: 'GSTIN and registration verified',
    body: 'Checked against the GST portal, not a screenshot they sent us.',
  },
  {
    n: '02',
    group: 'Work',
    title: 'Two finished sites visited',
    body: 'We stand in the flat. Photographs from a studio’s Instagram do not count.',
  },
  {
    n: '03',
    group: 'Clients',
    title: 'Past clients called back',
    body: 'Three calls, asked about delays and final versus quoted cost.',
  },
  {
    n: '04',
    group: 'Money',
    title: 'Rate card filed with us',
    body: 'Their own prices, on record, which is what your first quote is priced from.',
  },
  {
    n: '05',
    group: 'Labour',
    title: 'In-house or named contractors',
    body: 'You know who will actually be in your flat, before they arrive.',
  },
  {
    n: '06',
    group: 'After',
    title: 'Written warranty terms',
    body: 'On hardware, finish and workmanship — with the duration stated.',
  },
];

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

            {/* "Get", never "request". See the note at the top of this file. */}
            <Cta href="/quiz" className="!px-5 !py-2.5 !text-[13.5px]">
              Get my first quote
            </Cta>
          </div>
        </Wrap>
      </header>

      {/* ── Hero ── */}
      <section className="relative">
        <div className="relative min-h-[max(640px,88vh)] w-full overflow-hidden">
          <Image
            src={PHOTOS.hero.src}
            alt={PHOTOS.hero.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(44,38,36,.88) 0%, rgba(44,38,36,.55) 42%, rgba(44,38,36,.30) 72%, rgba(44,38,36,.42) 100%)',
            }}
          />

          <div className="absolute inset-x-0 bottom-0">
            <Wrap className="pb-12 sm:pb-16">
              {/* Contrast: this eyebrow sat over a plant at 40% opacity in
                  review and could not be read. It is on the scrim now. */}
              <p className="oi-num m-0 mb-5 text-[10.5px] uppercase tracking-[0.2em] text-white/80">
                Bare flat → finished home · filmed in Kothrud
              </p>

              <h1 className="oi-display m-0 mb-5 max-w-[19ch] text-[clamp(2.1rem,1.3rem+3.3vw,3.7rem)] text-white">
                Watch a Pune flat get finished. Then get quoted for yours.
              </h1>

              <p className="m-0 mb-9 max-w-[52ch] text-[16.5px] leading-[1.62] text-white/85">
                Nine questions about your flat. Three studios matched to the answers. A first quote
                priced in three seconds — and an architect of your own while you compare.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Cta href="/quiz">Get my first quote</Cta>
                <a
                  href="#film"
                  className="inline-flex items-center gap-2.5 border border-white/30 px-5 py-3.5 text-[14px] text-white no-underline transition-colors hover:border-white/70"
                >
                  <PlayIcon />
                  Watch the 90-second film
                </a>
              </div>
            </Wrap>
          </div>

          <div className="absolute bottom-12 right-0 hidden lg:block">
            <Wrap>
              <p className="oi-num m-0 text-right text-[10.5px] uppercase tracking-[0.18em] text-white/70">
                Showreel · 06 projects
              </p>
            </Wrap>
          </div>
        </div>
      </section>

      {/* ── Stats ──
          Three figures, each with its provenance. The rating is real client
          data from a studio's own finished projects, which is why it is
          labelled as one studio's record rather than a site-wide average —
          One Interiors has not delivered 41 projects and must not imply it. */}
      <Section className="border-b border-[var(--line)] bg-[var(--card)]">
        <Wrap>
          <div className="grid divide-y divide-[var(--line)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Stat
              figure="4.8"
              unit="/ 5"
              label="from 41 clients who finished a project"
              source="One listed studio’s own record"
            />
            <Stat figure="68" label="briefs matched to Pune studios" />
            <Stat
              figure="₹5.95 L–₹27.2 L"
              label="range of quotes compared here"
            />
          </div>

          <div className="flex items-start gap-2.5 border-t border-[var(--line)] py-5">
            <span style={{ color: 'var(--sec)' }} className="mt-0.5">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M2.5 8.5 6 12l7.5-8"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="m-0 text-[14px] font-medium">Free until you book</p>
              <p className="m-0 text-[13px] text-[var(--ink2)]">studios pay us, never you</p>
            </div>
          </div>
        </Wrap>
      </Section>

      {/* ── How it works — the pinned spine ── */}
      <HowItWorks />

      {/* ── Your architect ── */}
      <section className="relative overflow-hidden">
        <Image
          src={PHOTOS.architect.src}
          alt={PHOTOS.architect.alt}
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg,rgba(44,38,36,.72),rgba(44,38,36,.86))' }}
        />

        <Wrap className="relative py-20 sm:py-24">
          <div className="mb-6 flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <Mark className="h-4 w-4 text-white/70" />
              <span className="oi-display text-[16px] text-white/85">One Interiors</span>
            </span>
            <span className="oi-num text-[10px] uppercase tracking-[0.18em] text-white/55">
              Your architect
            </span>
          </div>

          <div className="oi-glass max-w-[720px] p-6 sm:p-8">
            <p className="oi-label m-0 mb-3">Your architect · assigned to you</p>

            <div className="mb-5 flex flex-wrap items-center gap-4">
              <Image
                src={PHOTOS.expert.src}
                alt="Nikhil Bhave"
                width={120}
                height={120}
                className="h-16 w-16 flex-none rounded-[12px] object-cover"
              />
              <div className="min-w-0">
                <p className="oi-display m-0 text-[24px]">Nikhil Bhave</p>
                <p className="m-0 text-[13.5px] leading-snug text-[var(--ink2)]">
                  Stays with you from brief to handover. Paid by us, never by a studio.
                </p>
              </div>
            </div>

            <p className="oi-label m-0 mb-3 border-t border-[var(--line)] pt-5">
              He verifies every step
            </p>

            <ul className="m-0 mb-6 flex list-none flex-col gap-0 p-0">
              {[
                ['Brief read back to you', 'Signed off'],
                ['Shortlist and studio checks', 'Signed off'],
                ['Quote read line by line', 'Today'],
                ['Material samples signed off', ''],
                ['Site visits and handover', ''],
              ].map(([label, state]) => {
                const done = state === 'Signed off';
                const now = state === 'Today';
                return (
                  <li
                    key={label}
                    className="flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0"
                  >
                    {done ? (
                      <span style={{ color: 'var(--sec)' }} className="flex-none">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <circle cx="8" cy="8" r="7.25" fill="currentColor" />
                          <path
                            d="M4.9 8.2 6.9 10.2 11.1 6"
                            stroke="#fff"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    ) : (
                      <span
                        aria-hidden
                        className="h-4 w-4 flex-none rounded-full border"
                        style={{
                          borderColor: now ? 'var(--acc)' : 'var(--line)',
                          background: now ? 'var(--acc)' : 'transparent',
                        }}
                      />
                    )}
                    <span className={`flex-1 text-[14.5px] ${state ? '' : 'text-[var(--ink2)]'}`}>
                      {label}
                    </span>
                    {state ? (
                      <span
                        className="oi-num flex-none text-[10px] uppercase tracking-[0.14em]"
                        style={{ color: now ? 'var(--acc)' : 'var(--ink2)' }}
                      >
                        {state}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="oi-glass-inner flex flex-wrap items-center justify-between gap-4 bg-[var(--bg)] p-4">
              <p className="m-0 max-w-[52ch] text-[13.5px] leading-snug">
                <span className="oi-num mr-1 text-[15px] text-[var(--ink2)]">&ldquo;</span>
                I&rsquo;d ask Teakline to re-quote the kitchen on 18mm BWP before you sign anything.
              </p>
              <Cta href="/expert" intent="quiet" className="!px-4 !py-2 !text-[13px]">
                Call Nikhil
              </Cta>
            </div>
          </div>
        </Wrap>
      </section>

      {/* ── Why we built this ── */}
      <section id="film" className="relative overflow-hidden">
        <Image
          src={PHOTOS.film.src}
          alt={PHOTOS.film.alt}
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(105deg,rgba(44,38,36,.90) 30%,rgba(44,38,36,.55))' }}
        />

        <Wrap className="relative py-20 sm:py-28">
          <p className="oi-num m-0 mb-5 text-[10.5px] uppercase tracking-[0.2em] text-white/70">
            90 seconds · why we built this
          </p>

          <h2 className="oi-display m-0 mb-5 max-w-[24ch] text-[clamp(1.75rem,1.15rem+2.3vw,2.85rem)] text-white">
            Nobody should sign a ₹18 lakh contract they can&rsquo;t read.
          </h2>

          <p className="m-0 mb-9 max-w-[54ch] text-[16px] leading-[1.62] text-white/80">
            Two Pune studios, one rate card each, and a promise that every number on your quote has
            a quantity and a material behind it.
          </p>

          {/* Placeholder until the MP4 exists — see imagery.ts. */}
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-4 rounded-full border border-white/25 bg-white/5 py-2 pl-2 pr-6 text-left text-white transition-colors hover:border-white/60"
          >
            <span
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full"
              style={{ background: 'var(--acc)' }}
            >
              <PlayIcon size={14} />
            </span>
            <span>
              <span className="block text-[14.5px] font-medium">Watch the film</span>
              <span className="oi-num block text-[10px] uppercase tracking-[0.16em] text-white/60">
                01:32 · sound on
              </span>
            </span>
          </button>
        </Wrap>
      </section>

      {/* ── Portfolio ── */}
      <Portfolio />

      {/* ── Packages ── */}
      <section id="packages" className="border-t border-[var(--line)] py-20 sm:py-24">
        <Wrap>
          <Eyebrow>Packages</Eyebrow>
          <Heading className="mb-4 max-w-[24ch]">
            Three bands, described in materials rather than adjectives.
          </Heading>

          <p className="oi-label m-0 mb-1">Priced for a 2 BHK · 1,180 sq ft</p>
          <p className="m-0 mb-10 text-[14px] text-[var(--ink2)]">
            Your quiz re-costs these for your area.
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            {PACKAGES.map((band) => (
              <article
                key={band.name}
                className="relative flex flex-col border bg-[var(--card)] p-6"
                style={{
                  borderColor: band.featured ? 'var(--acc)' : 'var(--line)',
                }}
              >
                {band.featured ? (
                  <span
                    className="oi-num absolute -top-px right-0 px-3 py-1 text-[9.5px] uppercase tracking-[0.16em] text-white"
                    style={{ background: 'var(--acc)' }}
                  >
                    Most compared
                  </span>
                ) : null}

                <p className="oi-label m-0 mb-3">{band.name}</p>
                <p className="oi-num m-0 mb-3 text-[26px] leading-none">{band.range}</p>
                <p className="m-0 mb-6 min-h-[3.2em] text-[13.5px] leading-[1.55] text-[var(--ink2)]">
                  {band.promise}
                </p>

                <div className="mb-7">
                  {band.specs.map(([label, value]) => (
                    <SpecRow
                      key={label}
                      label={label!}
                      value={value!}
                      better={band.name !== 'Essential'}
                    />
                  ))}
                </div>

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

      {/* ── Why trust us ── */}
      <Section id="trust" dark className="py-20 sm:py-24">
        <Wrap>
          <Eyebrow onDark>Why trust us</Eyebrow>
          <Heading className="mb-6 max-w-[26ch] text-[#f4efe8]">
            Studios pay us. So we are strict with studios, not with you.
          </Heading>

          <p className="oi-num m-0 mb-1 text-[10.5px] uppercase tracking-[0.18em] text-white/70">
            12 checks before a studio is listed
          </p>
          <p className="oi-num m-0 mb-12 text-[10.5px] uppercase tracking-[0.18em] text-white/45">
            Each one has a named verifier
          </p>

          <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKS.map((check) => (
              <div key={check.n} className="border-l border-white/15 pl-5">
                <p className="oi-num m-0 mb-3 text-[10px] uppercase tracking-[0.16em] text-white/45">
                  {check.n} · {check.group}
                </p>
                <p className="m-0 mb-2 text-[15px] font-medium text-[#f4efe8]">{check.title}</p>
                <p className="m-0 text-[13.5px] leading-[1.6] text-white/60">{check.body}</p>
              </div>
            ))}
          </div>

          <p className="m-0 mt-14 max-w-[70ch] text-[14.5px] leading-[1.7] text-white/65">
            The remaining six checks cover insurance, safety on site, drawing standards, material
            sourcing, payment milestones and dispute history. Any studio that fails one is not
            listed until it is fixed.
          </p>

          <div className="mt-8">
            <Cta href="/verification" intent="onDark">
              Read all twelve checks
            </Cta>
          </div>
        </Wrap>
      </Section>

      {/* ── Voices ── */}
      <Testimonials />

      {/* ── FAQ ── */}
      <Faq />

      {/* ── Closing ── */}
      <section style={{ background: 'var(--acc)' }} className="py-16 sm:py-20">
        <Wrap>
          <h2 className="oi-display m-0 mb-4 max-w-[24ch] text-[clamp(1.6rem,1.15rem+1.8vw,2.4rem)] text-white">
            Nine questions. Then a quote you can actually read.
          </h2>
          <p className="m-0 mb-8 max-w-[56ch] text-[15.5px] leading-[1.6] text-white/85">
            Three minutes, no phone call, and nothing payable by you at any point.
          </p>
          <div className="flex flex-wrap gap-3">
            <Cta href="/quiz" intent="onAccent">
              Start the quiz
            </Cta>
            <Cta href="/expert" intent="onDark">
              Talk to an architect first
            </Cta>
          </div>
        </Wrap>
      </section>

      {/* ── Footer ── */}
      <Section dark className="py-16">
        <Wrap>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <span className="mb-4 flex items-center gap-2.5">
                <Mark className="h-5 w-5 text-white/80" />
                <span className="oi-display text-[19px] text-[#f4efe8]">One Interiors</span>
              </span>
              <p className="m-0 mb-8 max-w-[34ch] text-[13.5px] leading-[1.6] text-white/60">
                Interior studios in Pune, checked twelve ways and quoted line by line.
              </p>

              <p className="oi-num m-0 mb-3 text-[10px] uppercase tracking-[0.16em] text-white/45">
                Talk to us
              </p>
              <a
                href="mailto:hello@oneinteriors.in"
                className="block text-[14px] text-white/75 no-underline hover:text-white"
              >
                hello@oneinteriors.in
              </a>
              <a href="tel:+912040000000" className="oi-num block text-[14px] text-white/75 no-underline hover:text-white">
                +91 20 4000 0000
              </a>
              <p className="oi-num m-0 mt-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                Mon–Sat · 10:00–19:00 IST
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
                ['/verification', 'The twelve checks'],
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
