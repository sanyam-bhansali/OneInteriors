'use client';

/**
 * The testimonial pager and the FAQ.
 *
 * Together in one file because they share one rule — **nothing on this page
 * moves on its own.** No auto-advancing carousel, no auto-opening accordion.
 * A reader who stopped to read a quote should not have it taken away, and a
 * page that animates while you are reading it is a page you stop trusting to
 * hold still. The walkthrough further up the page obeys the same rule, which
 * is why it is click-selected rather than on a timer.
 *
 * The portfolio rail used to live here too. It left when it grew a modal —
 * see `Portfolio.tsx`.
 */

import { useState } from 'react';
import Image from 'next/image';
import { FINISHED_WORK } from '@/lib/imagery';
import { Wrap, Eyebrow, Heading } from './parts';

// ── Testimonials ────────────────────────────────────────────────

/**
 * Three voices, and each one is about a different thing the product does.
 *
 * Deliberately not three people saying it was a good experience. The first is
 * about the comparison catching a material difference, the second about
 * nobody phoning, the third about the architect reading the quote — which are
 * the three claims the page makes above. A testimonial that does not
 * corroborate a specific claim is decoration.
 */
const VOICES = [
  {
    quote:
      'Two quotes were ₹1.25 L apart and I thought one studio was overcharging. It was board thickness. I’d have never known.',
    name: 'Shruti & Aniket D.',
    meta: '2 BHK · Baner · ₹16.8 L',
  },
  {
    quote:
      'Nobody phoned me for a week and I meant that as a compliment. The first quote was on screen before I’d finished my tea.',
    name: 'Rohan M.',
    meta: '3 BHK · Kothrud · ₹21.4 L',
  },
  {
    quote:
      'My architect sat on the call while the studio walked through the quote. She caught two lines that had no quantity against them.',
    name: 'Meghana K.',
    meta: '2 BHK · Wakad · ₹9.6 L',
  },
];

export function Testimonials() {
  const [at, setAt] = useState(0);
  const voice = VOICES[at]!;

  // Alabaster, not Raw Silk. It sits between the dark walkthrough and the
  // Raw Silk portfolio, and on the page ground it was the third cream band
  // in a row — every boundary on this page should be a change of material.
  return (
    <section className="border-y border-[var(--line)] bg-[var(--card)] py-16 sm:py-20">
      <Wrap>
        <Eyebrow>What it was like</Eyebrow>

        {/* Two columns. A pull quote alone on a wide cream field is a lot of
            empty ground, and the photograph is doing real work here — the
            quote is about a kitchen, so the reader can see the kitchen. */}
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            {/* Keyed so the quote re-enters rather than the words changing
                underneath the reader mid-sentence. */}
            <div key={at} className="oi-swap">
              <blockquote className="m-0 mb-7 max-w-[22ch]">
                <p className="oi-display m-0 text-[clamp(1.5rem,1.05rem+1.7vw,2.2rem)]">
                  &ldquo;{voice.quote}&rdquo;
                </p>
              </blockquote>

              <div className="border-t border-[var(--line)] pt-5">
                <p className="m-0 text-[14.5px] font-medium">{voice.name}</p>
                <p className="oi-label m-0 mt-1">{voice.meta}</p>
              </div>
            </div>

            {/* Boxed, not bare numerals — a row of loose digits under a quote
                does not read as something you can press. */}
            <div className="mt-7 flex items-center gap-2">
              {VOICES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAt(i)}
                  aria-label={`Read voice ${i + 1}`}
                  aria-current={i === at ? 'true' : undefined}
                  className="oi-num cursor-pointer border px-3 py-1.5 text-[11px] transition-colors"
                  style={{
                    borderColor: i === at ? 'var(--acc)' : 'var(--line)',
                    color: i === at ? 'var(--acc)' : 'var(--ink2)',
                    background: 'transparent',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </button>
              ))}
              <span className="oi-label m-0 ml-3">
                {String(at + 1).padStart(2, '0')} / {String(VOICES.length).padStart(2, '0')}
              </span>
            </div>
          </div>

          <Image
            src={FINISHED_WORK[1]!.photo.src}
            alt={FINISHED_WORK[1]!.photo.alt}
            width={880}
            height={640}
            sizes="(max-width: 1024px) 100vw, 44vw"
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
      </Wrap>
    </section>
  );
}

// ── FAQ ─────────────────────────────────────────────────────────

/**
 * The awkward ones first.
 *
 * "What does this cost me" and "can a studio pay to rank higher" are the two
 * questions every visitor is silently asking, and burying them under
 * "what areas do you cover" is how a FAQ reads as evasive. The first one is
 * open by default because the answer is the offer.
 */
const QUESTIONS = [
  {
    q: 'What does One Interiors cost me?',
    a: 'Nothing. The quiz, the matches, the first quotes, the comparison and your architect are all free. A studio pays us a fee only if you book it, and that fee does not change your quote — it comes out of the studio’s margin, and their rate card is on file with us so we can see if it moves.',
  },
  {
    q: 'How can a quote be ready in three seconds?',
    a: 'Because no studio is asked. Every listed studio files its own rate card with us — per sq ft for wardrobes, per running foot for kitchen, per point for electrical. Our system reads your brief, applies that studio’s rates, and writes the quote line by line. It is their pricing, not our estimate. The studio confirms or revises it after a site visit.',
  },
  {
    q: 'Can a studio pay to rank higher?',
    a: 'No. Matches are scored on your answers — locality, scope, budget band, style leaning, household — and on which of the fifteen checks the studio has cleared. There is no paid placement, and we show you the score and the reason behind it so you can argue with it. A subscription buys volume, never position.',
  },
  {
    q: 'Will my number be sold to ten contractors?',
    a: 'No. Your brief is visible to the three matched studios only, and your phone number is released to a studio only when you choose to be introduced. Until then the conversation happens through us, and you can stop it at any point.',
  },
  {
    q: 'What does the architect actually do?',
    a: 'Reads your brief back to you, checks the shortlist, goes through each quote line by line, signs off material samples against what was quoted, and attends the site visits that matter. They are on our payroll, so there is no version of this where they earn more by pushing you towards a particular studio.',
  },
  {
    q: 'Do you work outside Pune?',
    a: 'Not yet. Verification means visiting sites and calling clients, and we can only do that properly in one city at a time. Right now that city is Pune — Kothrud, Baner, Wakad, Aundh, Hinjawadi and Kharadi.',
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-[var(--line)] py-16 sm:py-20">
      <Wrap>
        <Eyebrow>Questions people actually ask</Eyebrow>
        <Heading className="mb-10 max-w-[18ch]">The awkward ones first.</Heading>

        <ul className="m-0 flex list-none flex-col p-0">
          {QUESTIONS.map((item, i) => {
            const on = open === i;
            return (
              <li key={item.q} className="border-b border-[var(--line)] first:border-t first:border-t-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setOpen(on ? null : i)}
                  aria-expanded={on}
                  className="flex w-full cursor-pointer items-center justify-between gap-6 border-0 bg-transparent px-0 py-5 text-left"
                >
                  <span className="oi-display text-[clamp(1.05rem,.95rem+.4vw,1.3rem)]">
                    {item.q}
                  </span>
                  <span
                    aria-hidden
                    className="oi-num flex-none text-[17px] leading-none transition-transform"
                    style={{
                      color: 'var(--acc)',
                      transform: on ? 'rotate(45deg)' : 'none',
                    }}
                  >
                    +
                  </span>
                </button>

                {/* Always rendered, never conditionally mounted. A conditional
                    answer cannot animate — there is nothing to transition from
                    — and it also hides the text from find-in-page, which is how
                    a lot of people actually use a FAQ. */}
                <div className="oi-reveal" data-open={on} aria-hidden={!on}>
                  <div>
                    <p className="m-0 max-w-[68ch] pb-6 text-[14.5px] leading-[1.7] text-[var(--ink2)]">
                      {item.a}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Wrap>
    </section>
  );
}
