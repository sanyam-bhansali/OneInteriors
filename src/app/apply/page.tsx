import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Eyebrow } from '@/components/ui';
import { SiteHeader, SiteFooter } from '@/components/chrome';
import { Glass } from '@/components/oi/Surfaces';
import { CHECK_LABELS, TIER_CHECKS } from '@/modules/studio/types';

export const metadata: Metadata = {
  title: 'Apply to join',
  description:
    'A customer who has already seen your work, read your quote and asked to meet you. Not a lead. Apply to the One Interiors roster in Pune.',
  robots: { index: false, follow: false },
};

const TOTAL_CHECKS = TIER_CHECKS.LISTED.length + TIER_CHECKS.VERIFIED.length;

/**
 * The pitch. The form is at `/apply/start`.
 *
 * ## Why this is two pages
 *
 * One page that asks somebody to DECIDE and to TYPE does neither well. A
 * studio owner scrolling past a form field while still working out whether
 * this is another leads platform is being asked two questions at once, and the
 * form wins the attention while losing the argument.
 *
 * So this page has exactly one action, repeated twice, and nothing else to do.
 *
 * ## What it is arguing
 *
 * Every interior studio in Pune has been on a platform that sold the same
 * enquiry to eight of them. That is the frame a studio arrives with, and the
 * page's whole job is to answer it in the first screen and then prove it.
 *
 * The proof is §3 — the introduction rendered as the artifact it actually is,
 * rather than described. Nobody argues with the thing itself. It is the only
 * glass surface on the page, because glass is what the product uses for a real
 * software view (DESIGN-LANGUAGE §3), and this is one.
 */
export default function ApplyPage() {
  return (
    <>
      <SiteHeader />

      <main>
        {/* ── 1 · Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-[var(--color-rule)]">
          <div className="grid-ground grid-ground-fade absolute inset-0" aria-hidden="true" />
          <Container size="wide" className="relative">
            <div className="grid grid-cols-1 items-center gap-10 py-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-16 lg:py-20">
              <div>
                <Eyebrow>For interior studios · Pune</Eyebrow>
                <h1 className="display mb-6 max-w-[15ch]">
                  We only work with studios we can{' '}
                  <span className="text-[var(--color-petrol)]">stand behind</span>.
                </h1>
                <p className="lede mb-5 max-w-[46ch]">
                  You won&rsquo;t get a lead from us. You&rsquo;ll get a customer who has already
                  seen your work, read your quote, and asked to meet you — at their flat, at a
                  time they picked.
                </p>
                <p className="m-0 mb-8 max-w-[44ch] text-[16px] leading-relaxed text-[var(--color-ink)]">
                  One introduction, one studio. Nobody else gets called.
                </p>

                <ApplyCta />
              </div>

              {/* The artifact, in the hero. It is the argument, so it does not
                  wait until the reader has scrolled to find it. */}
              <IntroductionCard />
            </div>
          </Container>
        </section>

        {/* ── 2 · The contrast ─────────────────────────────────── */}
        <section className="border-b border-[var(--color-rule)] py-14 sm:py-20">
          <Container size="wide">
            <Eyebrow>What this is not</Eyebrow>
            <h2 className="h1 mb-3 max-w-[20ch]">This is not a leads platform.</h2>
            <p className="m-0 mb-10 max-w-[48ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
              You have been on those. Here is the difference, plainly.
            </p>

            {/* Two lists rather than a bordered table, and the left one is
                deliberately recessed. The recession does the arguing — red
                crosses against a named competitor read as insecurity, while
                setting it quietly beside you reads as confidence.

                The recession is SIZE and the absence of a tick, not a lighter
                ink. `--color-ink-3` measures 3.54:1 on paper-2 and 3.82:1 on
                paper — large-text-only either way — and this column is real
                content a studio is meant to read and recognise. Fading the
                thing you want them to recognise is self-defeating as well as
                inaccessible. */}
            <div className="grid grid-cols-1 gap-px overflow-hidden border border-[var(--color-rule)] bg-[var(--color-rule)] md:grid-cols-2">
              <div className="bg-[var(--color-paper-2)] p-7 sm:p-9">
                <p className="label m-0 mb-5 text-[var(--color-ink-2)]">
                  Where you have been listed
                </p>
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                  {THEM.map((t) => (
                    <li
                      key={t}
                      className="m-0 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[var(--color-paper)] p-7 sm:p-9">
                <p className="label m-0 mb-5 text-[var(--color-petrol)]">Here</p>
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                  {US.map((t) => (
                    <li key={t} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5">
                      <Check />
                      <span className="text-[15.5px] leading-relaxed text-[var(--color-ink)]">
                        {t}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Container>
        </section>

        {/* ── 3 · What you get ─────────────────────────────────── */}
        <section className="border-b border-[var(--color-rule)] py-14 sm:py-20">
          <Container size="wide">
            <Eyebrow>What you get</Eyebrow>
            <h2 className="h1 mb-10 max-w-[22ch]">
              Four things you do not get anywhere else.
            </h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {BENEFITS.map((b, i) => (
                <div
                  key={b.title}
                  className="border-t-2 border-[var(--color-petrol)] bg-[var(--color-paper-2)] p-7"
                >
                  <span className="tabular mb-4 block font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] text-[var(--color-petrol)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="h3 mb-2">{b.title}</p>
                  <p className="m-0 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
                    {b.body}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── 4 · Verification, reframed ───────────────────────── */}
        <section className="border-b border-[var(--color-rule)] py-14 sm:py-20">
          <Container size="wide">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
              <div>
                <Eyebrow>Verification</Eyebrow>
                <h2 className="h1 mb-5 max-w-[20ch]">
                  The badge is work we did so they don&rsquo;t have to.
                </h2>
                <p className="m-0 mb-4 max-w-[46ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
                  Before you appear on the site we check {TOTAL_CHECKS} things: your registration
                  and GST filing history, references we ring ourselves, and two finished sites we
                  visit in person. It takes about two weeks.
                </p>
                <p className="m-0 mb-6 max-w-[46ch] text-[16px] leading-relaxed text-[var(--color-ink)]">
                  That is why a customer accepts your number instead of haggling it down. They
                  are not trusting a profile photograph — they are trusting the checks, and the
                  checks have your name on them.
                </p>
                <Link
                  href="/verification"
                  className="text-[15px] text-[var(--color-petrol)] underline underline-offset-4"
                >
                  See all {TOTAL_CHECKS} →
                </Link>
              </div>

              <ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-2.5 self-center p-0 sm:grid-cols-2">
                {[...TIER_CHECKS.LISTED, ...TIER_CHECKS.VERIFIED].map((c) => (
                  <li key={c} className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2">
                    <Check />
                    <span className="font-[family-name:var(--font-mono)] text-[11.5px] leading-[1.5] tracking-[0.02em] text-[var(--color-ink-2)]">
                      {CHECK_LABELS[c]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>

        {/* ── 5 · The honest filter ────────────────────────────── */}
        <section className="border-b border-[var(--color-rule)] py-14 sm:py-20">
          <Container size="narrow">
            {/* No card. This should read like somebody being straight with
                you, which means it should not look designed. */}
            <Eyebrow>Before you apply</Eyebrow>
            <h2 className="h1 mb-8 max-w-[22ch]">This is probably not for you if…</h2>

            <div className="flex flex-col gap-7 border-y border-[var(--color-rule)] py-8">
              {NOT_FOR_YOU.map((n) => (
                <div key={n.title}>
                  <p className="m-0 mb-1.5 text-[16.5px] font-bold leading-snug text-[var(--color-ink)]">
                    {n.title}
                  </p>
                  <p className="m-0 max-w-[54ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
                    {n.body}
                  </p>
                </div>
              ))}
            </div>

            {/* The bar, stated before the application rather than discovered
                after approval.

                A studio used to learn about the three projects at step three
                of five, having already been accepted and having already spent
                half an hour — which reads as a bait-and-switch even though it
                was never meant as one. Saying it here costs a paragraph. Not
                saying it costs the trust of the studio it surprises. */}
            <div className="mt-9 border-l-2 border-[var(--color-petrol)] pl-6">
              <p className="m-0 mb-2 text-[16.5px] font-bold leading-snug text-[var(--color-ink)]">
                One thing worth knowing now.
              </p>
              <p className="m-0 max-w-[54ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
                A listed studio shows <strong>three completed projects</strong> — real homes, with
                photographs and a client we can ring. If you are not there yet, say so on the form.
                Work in progress, a project you finished under a previous practice, a site we can
                come and stand in: all of it counts for something, and a person reads it. We would
                rather have that conversation than lose a practice that will be excellent in two
                years.
              </p>
            </div>
          </Container>
        </section>

        {/* ── 6 · What happens next, then the button ───────────── */}
        <section className="py-14 sm:py-20">
          <Container size="wide">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
              <div>
                <Eyebrow>What happens next</Eyebrow>
                <h2 className="h1 mb-6 max-w-[16ch]">Ten minutes, then it is with us.</h2>
                <ApplyCta />
              </div>

              <ol className="m-0 flex list-none flex-col gap-6 p-0">
                <Step n="01" title="You apply" body="Ten minutes. Nothing you send here is published." />
                <Step n="02" title="We reply within a week" body="Either way, with a reason. A call before any decision." />
                <Step
                  n="03"
                  title="We verify"
                  body={`${TOTAL_CHECKS} checks — identity, GST filing history, references we ring, and two finished sites we visit.`}
                />
                <Step n="04" title="You build your profile" body="Your work, your words, your rates. We help you shape it." />
                <Step n="05" title="You go live" body="Matched to customers whose brief actually fits what you do." />
              </ol>
            </div>

            <p className="m-0 mt-14 border-t border-[var(--color-rule)] pt-6 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
              Questions before you apply? Email{' '}
              <a
                href="mailto:hello@oneinteriors.in"
                className="text-[var(--color-petrol)] underline underline-offset-4"
              >
                hello@oneinteriors.in
              </a>{' '}
              — a person reads it. We charge only on work we bring you, and only when it closes;
              clients you already have are yours.
            </p>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

// ── Content ─────────────────────────────────────────────────────

const THEM = [
  'One enquiry, sold to eight studios',
  'You ring someone who has had six calls already',
  'You compete on price before you have met',
  'You pay per lead, win or lose',
  'Your name is one of forty in a directory',
];

const US = [
  'One brief, matched to the three studios that actually fit',
  'They choose you, then we introduce',
  'They have read your quote and seen your work first',
  'You pay on work that closes',
  'Your name is on a roster you can count',
];

const BENEFITS = [
  {
    title: 'A customer who has already chosen you',
    body: 'They have read your profile, looked at your finished work, and compared your quote against two others. The first conversation starts at “when can you come” rather than “what do you charge”.',
  },
  {
    title: 'A site visit, not a phone number',
    body: 'Every introduction carries the flat, the configuration, the carpet area and a time they are free. You walk in already knowing the space.',
  },
  {
    title: 'Your pricing seen, and accepted',
    body: 'They saw your numbers before they asked for you. Nobody is going to ask you to cut thirty percent after the measurement.',
  },
  {
    title: 'Software to run the rest of your practice',
    body: 'Your leads, your projects, quotations priced off your own rate card, and a PDF that goes out with your logo on it — not ours. Yours whether we send you work that month or not.',
  },
];

const NOT_FOR_YOU = [
  {
    title: 'You are after volume.',
    body: 'We would rather send you four projects you want than forty you do not. If your model needs a full funnel every week, this will feel thin.',
  },
  {
    title: 'You quote low and revise up.',
    body: 'We publish the gap between the quoted number and the final one, on your profile, permanently. That is the point of the list, and it cuts both ways.',
  },
  // The third bullet here used to read "You cannot yet show three finished
  // projects… it is the one thing we cannot work around." That was true when it
  // was written and is not true now: the portfolio step takes a declared
  // shortfall, reviewed by a person. Leaving the line up would have been the
  // worse kind of dishonesty — turning away exactly the young practices the
  // escape hatch was built to keep. The bar itself is stated below the list
  // instead, where it belongs: a requirement with a door, not a filter.
  {
    title: 'You want to be ranked higher than you are.',
    body: 'Nobody can pay to sit above anyone. Position comes out of the match and nothing else, and there is no product on this page that changes that.',
  },
];

// ── Pieces ──────────────────────────────────────────────────────

/**
 * What actually lands in a studio's inbox.
 *
 * The only glass surface on the page, deliberately: glass is what this product
 * uses for a real software view over photography, and that is exactly the
 * claim being made here — this is the screen, not an illustration of it. Every
 * fact is mono, because money and quantities are always mono, and the
 * customer's own line is serif italic because it is a person speaking rather
 * than a field.
 */
function IntroductionCard() {
  return (
    <div className="relative">
      <p className="label m-0 mb-3 text-[var(--color-ink-2)]">An introduction</p>

      <Glass className="relative">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="m-0 font-[family-name:var(--font-mono)] text-[13px] uppercase tracking-[0.14em] text-[var(--color-ink)]">
              Anita K.
            </p>
            <p className="m-0 mt-1 text-[14px] text-[var(--color-ink-2)]">
              Kumar Prospera, Baner
            </p>
          </div>
          <span className="whitespace-nowrap rounded-full bg-[var(--color-ontrack-soft)] px-3 py-1 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-ontrack)]">
            Asked for you
          </span>
        </div>

        <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--color-rule)] pt-5">
          <Fact k="Home" v="2 BHK · 890 sq ft" />
          <Fact k="Scope" v="Full home, kitchen first" />
          <Fact k="Budget band" v="₹12 L – ₹15 L" />
          <Fact k="Site visit" v="Sat, 11:00am" />
        </dl>

        <p className="m-0 mt-5 border-t border-[var(--color-rule)] pt-5 font-[family-name:var(--font-display)] text-[17px] italic leading-snug text-[var(--color-ink)]">
          &ldquo;Read your Kharadi project. Asked for you.&rdquo;
        </p>
      </Glass>

      <p className="m-0 mt-4 max-w-[42ch] text-[14px] leading-relaxed text-[var(--color-ink-2)]">
        That is the whole thing. No dialler, no credits, no call queue. You read it, and you
        accept or you pass.
      </p>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      {/* ink-2, not ink-3. Measured: on the .oi-pane composite over Raw Silk
          (rgb 247,246,242) ink-3 computes 3.04:1 — below AA for text this
          small — while ink-2 is 5.56:1. The token looks fine against the page;
          it is the glass underneath that moves it, which is precisely what the
          .oi-pane comment in globals.css warns about. */}
      <dt className="label m-0 mb-1 text-[var(--color-ink-2)]">{k}</dt>
      <dd className="tabular m-0 font-[family-name:var(--font-mono)] text-[14px] leading-snug text-[var(--color-ink)]">
        {v}
      </dd>
    </div>
  );
}

function ApplyCta() {
  return (
    <div>
      <Link
        href="/apply/start"
        className="inline-flex min-h-[48px] items-center justify-center bg-[var(--color-petrol)] px-7 text-[15.5px] font-bold text-white transition-colors hover:bg-[var(--color-petrol-ink,var(--color-petrol))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-petrol)]"
      >
        Apply to join
      </Link>
      <p className="m-0 mt-3 font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.14em] text-[var(--color-ink-2)]">
        About 10 minutes · Nothing you send is published
      </p>
    </div>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="mt-[3px] h-4 w-4 shrink-0 text-[var(--color-ontrack)]"
    >
      <path
        d="M3.5 8.4l3 3 6-6.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[34px_minmax(0,1fr)] gap-4 border-b border-[var(--color-rule)] pb-6 last:border-0 last:pb-0">
      <span className="tabular font-[family-name:var(--font-mono)] text-[12px] leading-[1.6] text-[var(--color-petrol)]">
        {n}
      </span>
      <div>
        <p className="m-0 mb-1 text-[16px] font-bold leading-snug text-[var(--color-ink)]">
          {title}
        </p>
        <p className="m-0 max-w-[48ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          {body}
        </p>
      </div>
    </li>
  );
}
