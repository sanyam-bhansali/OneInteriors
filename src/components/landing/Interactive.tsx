'use client';

/**
 * The three pieces of the lower page that need the browser: the portfolio
 * rail, the testimonial pager and the FAQ.
 *
 * Grouped in one file because they share one rule — **nothing on this page
 * moves on its own.** No auto-advancing carousel, no auto-opening accordion.
 * A reader who stopped to read a quote should not have it taken away, and a
 * page that animates while you are reading it is a page you stop trusting to
 * hold still.
 */

import { useRef, useState } from 'react';
import Image from 'next/image';
import { FINISHED_WORK } from '@/lib/imagery';
import { Wrap, Eyebrow, Heading } from './parts';

// ── Portfolio ───────────────────────────────────────────────────

/**
 * Six flats, with what they cost printed on them.
 *
 * The cost is the entire reason this section is not a mood gallery. Every
 * competitor shows finished rooms; almost nobody prints the figure beside one,
 * because the figure is what invites the comparison they would lose.
 *
 * The rail is cropped at the right edge on purpose — a card cut by the
 * viewport is the only drag affordance that works without being explained, and
 * it is more honest than an arrow that suggests there are exactly two more.
 */
export function Portfolio() {
  const rail = useRef<HTMLDivElement>(null);

  const nudge = (direction: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.min(el.clientWidth * 0.8, 520), behavior: 'smooth' });
  };

  return (
    <section id="portfolio" className="border-t border-[var(--line)] py-20 sm:py-24">
      <Wrap>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Finished work · Pune</Eyebrow>
            <Heading className="max-w-[22ch]">Six flats, with what they cost printed on them.</Heading>
          </div>

          <div className="flex gap-2">
            {([-1, 1] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => nudge(d)}
                aria-label={d === -1 ? 'Previous projects' : 'Next projects'}
                className="flex h-10 w-10 items-center justify-center border border-[var(--line)] bg-[var(--card)] text-[var(--ink2)] transition-colors hover:border-[var(--ink2)] hover:text-[var(--ink)]"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d={d === -1 ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'}
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </Wrap>

      {/* Breaks the wrap deliberately so the rail runs to the edge. */}
      <div
        ref={rail}
        className="oi-rail flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-2 sm:px-8"
      >
        {FINISHED_WORK.map((project) => (
          <article
            key={`${project.locality}-${project.title}`}
            className="flex w-[280px] flex-none snap-start flex-col border border-[var(--line)] bg-[var(--card)] sm:w-[330px]"
          >
            <Image
              src={project.photo.src}
              alt={project.photo.alt}
              width={660}
              height={480}
              sizes="(max-width: 640px) 80vw, 330px"
              className="aspect-[4/3] w-full object-cover"
            />

            <div className="flex flex-1 flex-col p-5">
              <p className="oi-label m-0 mb-2">
                {project.locality} · {project.areaSqft.toLocaleString('en-IN')} SQ FT
              </p>
              <h3 className="oi-display m-0 mb-2 text-[21px]">{project.title}</h3>
              <p className="m-0 mb-5 text-[13.5px] leading-[1.55] text-[var(--ink2)]">
                {project.note}
              </p>

              <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-[var(--line)] pt-3.5">
                <span className="text-[13px] text-[var(--ink2)]">{project.studio}</span>
                <span className="oi-num text-[15px]">{project.cost}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Wrap className="mt-5">
        <p className="oi-label m-0 text-right">
          Drag or scroll sideways · {String(FINISHED_WORK.length).padStart(2, '0')} projects
        </p>
      </Wrap>
    </section>
  );
}

// ── Testimonials ────────────────────────────────────────────────

const VOICES = [
  {
    quote:
      'Two quotes were ₹1.25 L apart and I thought one studio was overcharging. It was board thickness. I’d have never known.',
    name: 'Shruti & Aniket D.',
    meta: '2 BHK · Baner · ₹16.8 L',
  },
  {
    quote:
      'I had the first quote before I had finished my coffee. Nobody rang me, which after four months of portal sites was the part I noticed.',
    name: 'Rohit K.',
    meta: '3 BHK · Kharadi · ₹21.4 L',
  },
  {
    quote:
      'Nikhil read the quotation out to me line by line and told me which one to push back on. He works for them, not for the studio, and you can tell.',
    name: 'Meera S.',
    meta: '2 BHK · Kothrud · ₹13.9 L',
  },
];

export function Testimonials() {
  const [at, setAt] = useState(0);
  const voice = VOICES[at]!;

  return (
    <section className="border-t border-[var(--line)] py-20 sm:py-24">
      <Wrap>
        <Eyebrow>What it was like</Eyebrow>

        <blockquote className="m-0 mb-8 max-w-[24ch]">
          <p className="oi-display m-0 text-[clamp(1.6rem,1.1rem+1.9vw,2.4rem)]">
            &ldquo;{voice.quote}&rdquo;
          </p>
        </blockquote>

        <p className="m-0 text-[14.5px] font-medium">{voice.name}</p>
        <p className="oi-label m-0 mt-1">{voice.meta}</p>

        <div className="mt-8 flex items-center gap-3">
          {VOICES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAt(i)}
              aria-label={`Read voice ${i + 1}`}
              aria-current={i === at ? 'true' : undefined}
              className="oi-num border-0 bg-transparent p-0 text-[11px] transition-opacity"
              style={{ color: i === at ? 'var(--acc)' : 'var(--ink2)', opacity: i === at ? 1 : 0.55 }}
            >
              {String(i + 1).padStart(2, '0')}
            </button>
          ))}
          <span className="oi-label m-0 ml-2">
            {String(at + 1).padStart(2, '0')} / {String(VOICES.length).padStart(2, '0')}
          </span>
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
    a: 'Because nobody is asked. Every listed studio files its own rate card with us as a condition of being listed — their real prices, per item, per square foot. Your nine answers give us the quantities, we price those quantities against each studio’s filed card, and that arithmetic takes about three seconds. No studio is contacted and nobody is phoned.',
  },
  {
    q: 'Can a studio pay to rank higher?',
    a: 'No. A subscription buys volume — how many briefs a studio is shown for in a month. It can never move a studio above a better-fitting one for you. The ranking code takes no payment, fee or subscription as an input, which is the cheapest way to keep that true rather than merely promised.',
  },
  {
    q: 'Will my number be sold to ten contractors?',
    a: 'No. Your brief goes to the studios you pick, when you pick them, and to nobody else. You see your matches and your first quotes before you give us a phone number at all — the quiz needs no signup.',
  },
  {
    q: 'What does the architect actually do?',
    a: 'Reads your brief back to you so you know it was understood, checks the shortlist, reads the quotation line by line and tells you what to push back on, signs off material samples, and stays through site visits and handover. They are paid by us and never by a studio, which is the only arrangement under which that advice is worth having.',
  },
  {
    q: 'Do you work outside Pune?',
    a: 'Not yet. Every studio on this site has been visited, its GST filings checked and its past clients called — that is slow, local work and it does not scale by pressing a button. Pune first, properly.',
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-[var(--line)] py-20 sm:py-24">
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

                {on ? (
                  <p className="m-0 max-w-[68ch] pb-6 text-[14.5px] leading-[1.7] text-[var(--ink2)]">
                    {item.a}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Wrap>
    </section>
  );
}
