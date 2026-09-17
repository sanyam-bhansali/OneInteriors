'use client';

/**
 * How it works — the locked 4a structure.
 *
 * Steps pinned on the LEFT, scroll-driven, click to centre. A frosted-glass
 * frame over a project photograph on the RIGHT, holding one product snapshot
 * per step.
 *
 * ## Why the right-hand panel exists at all
 *
 * The heading is "Five steps, and you can see each one working." A list of
 * five text blurbs does not cash that cheque — it is the same promise every
 * competitor makes, in the same words, with nothing behind it. The snapshots
 * are the evidence: a real quote line with a quantity and a spec on it, a
 * score ring that says "matched on 4 of 6", a counter that moves. That is what
 * the section is for, and without it the section should not ship.
 *
 * ## Scroll-driven, not a carousel
 *
 * Carousels auto-advance past the step you were reading. Here the active step
 * is whatever you have scrolled to, which is the only reading order a page can
 * be sure about, and clicking a step scrolls you to it rather than mutating
 * some hidden index. Nothing moves on its own.
 *
 * ## Mobile
 *
 * Sticky side-by-side needs a viewport wide enough for two columns and tall
 * enough for the frame. Below `lg` it stacks: each step carries its own
 * snapshot underneath it, in order. The content is identical — no step and no
 * snapshot is dropped on a phone, because the phone is where most of Pune will
 * read this.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { PHOTOS } from '@/lib/imagery';
import { Wrap, Eyebrow, Heading, Cta } from './parts';
import { QuizSnap, MatchSnap, QuoteSnap, CompareSnap, ExpertSnap } from './snapshots';

interface Step {
  n: string;
  name: string;
  body: string;
  Snap: () => React.ReactElement;
}

const STEPS: Step[] = [
  {
    n: '01',
    name: 'OneQuiz',
    body: 'Nine questions fill in your flat — area, rooms, budget band.',
    Snap: QuizSnap,
  },
  {
    n: '02',
    name: 'OneMatch',
    body: 'Fourteen eligible studios narrow to three, scored and checked.',
    Snap: MatchSnap,
  },
  {
    n: '03',
    name: 'OneQuote',
    body:
      "One click. We price your brief off each studio's own rate card and hand you the first quote in three seconds.",
    Snap: QuoteSnap,
  },
  {
    n: '04',
    name: 'OneCompare',
    body: 'Quotes and materials side by side — board, shutter, hardware.',
    Snap: CompareSnap,
  },
  {
    n: '05',
    name: 'OneExpert',
    body: 'A personal architect, assigned to you, verifying every step.',
    Snap: ExpertSnap,
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  /**
   * The step nearest the middle of the viewport wins.
   *
   * An IntersectionObserver with a threshold fires on whichever step crosses
   * the line first, which on a fast scroll is not the one you are looking at.
   * Measuring distance from the centre on a throttled scroll is duller and
   * always agrees with what is actually in front of the reader.
   */
  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      let best = 0;
      let bestDistance = Infinity;

      stepRefs.current.forEach((el, i) => {
        if (!el) return;
        const box = el.getBoundingClientRect();
        const distance = Math.abs(box.top + box.height / 2 - middle);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });

      setActive(best);
    };

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const centre = useCallback((i: number) => {
    stepRefs.current[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  const Active = STEPS[active]!.Snap;

  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <Wrap>
        <Eyebrow>How it works</Eyebrow>
        <Heading className="mb-14 max-w-[20ch]">
          Five steps, and you can see each one working.
        </Heading>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          {/* ── The spine ── */}
          <ol className="m-0 flex list-none flex-col p-0">
            {STEPS.map((step, i) => {
              const on = i === active;
              const Snap = step.Snap;

              return (
                <li
                  key={step.name}
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  className="border-t border-[var(--line)] first:border-t-0 lg:min-h-[54vh] lg:py-10"
                >
                  <button
                    type="button"
                    onClick={() => centre(i)}
                    aria-current={on ? 'step' : undefined}
                    className="w-full cursor-pointer border-0 bg-transparent p-0 py-6 text-left lg:py-0"
                  >
                    <span className="mb-2 flex items-baseline gap-3">
                      <span
                        className="oi-num text-[11px] transition-colors"
                        style={{ color: on ? 'var(--acc)' : 'var(--ink2)' }}
                      >
                        {step.n}
                      </span>
                      <span
                        className="oi-display text-[clamp(1.45rem,1.1rem+1vw,1.9rem)] transition-opacity"
                        style={{ opacity: on ? 1 : 0.42 }}
                      >
                        {step.name}
                      </span>
                    </span>
                    <span
                      className="block max-w-[44ch] text-[14.5px] leading-[1.6] transition-opacity"
                      style={{ opacity: on ? 1 : 0.5, color: 'var(--ink2)' }}
                    >
                      {step.body}
                    </span>
                  </button>

                  {/* Phones get the snapshot inline, in order. Nothing is
                      dropped for the narrow viewport. */}
                  <div className="mb-8 mt-5 lg:hidden">
                    <div className="oi-glass p-3">
                      <Snap />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* ── The frame ── */}
          <div className="hidden lg:block">
            <div className="sticky top-[12vh]">
              <div className="relative overflow-hidden rounded-[26px]">
                <Image
                  src={PHOTOS.spine.src}
                  alt={PHOTOS.spine.alt}
                  width={900}
                  height={1100}
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  className="h-[76vh] w-full object-cover"
                />
                {/* Enough scrim that Alabaster cards hold against any frame of
                    the photograph, not just the light ones. */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(200deg,rgba(44,38,36,.34),rgba(44,38,36,.54))' }}
                />

                <div className="absolute inset-0 flex items-center justify-center p-7">
                  <div className="oi-glass w-full max-w-[420px] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="oi-label m-0">One Interiors</span>
                      <span className="oi-label m-0">{STEPS[active]!.name}</span>
                    </div>
                    {/* Keyed on the step so React remounts and the snapshot
                        fades rather than mutating field by field. */}
                    <div key={active} className="rise">
                      <Active />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <Cta href="/quiz">Start with nine questions</Cta>
        </div>
      </Wrap>
    </section>
  );
}
