'use client';

/**
 * Why trust us — the fifteen checks, as a scroll spine.
 *
 * ## Why a spine and not a grid of cards
 *
 * Twelve cards in a three-column grid is a wall, and a wall gets scanned:
 * the reader takes "lots of checks, seems thorough" and moves on, which is
 * the same thing they would have taken from the number alone. Reading them
 * one at a time is slower on purpose — the argument is cumulative, and the
 * counter filling as you go is the argument being made rather than stated.
 *
 * ## The read line
 *
 * The list is its own scroll container, and the active check is whichever row
 * is nearest 34% of that container's height — high enough that the row you are
 * reading is the row that is counted, rather than the one at the very top
 * which your eye has already left.
 *
 * Rows at or above the read line stay at full opacity because they are
 * *cleared*: the dimming is not decoration, it is the state of the count.
 *
 * ## Why the wheel handler is careful
 *
 * A nested scroll container that swallows wheel events is a scroll trap — the
 * page cannot get past the section. This one only claims the event while the
 * list has somewhere to go, and hands it straight back at either end.
 *
 * ## Keyboard and reduced motion
 *
 * The whole thing works without any of it. The list is a plain ordered list
 * in the DOM, every row is readable, and the ring is `aria-hidden` with the
 * count announced as text. Someone tabbing through, reading with a screen
 * reader or scrolling with reduced motion gets the fifteen checks in order
 * and misses nothing but the animation.
 */

import { useEffect, useRef, useState } from 'react';
import { Wrap, Eyebrow, Heading, Cta } from './parts';
import { CHECKS, CHECK_COUNT } from './checks';

/** r=54 at stroke-width 5. The circumference the dash array is drawn from. */
const R = 54;
const CIRCUMFERENCE = 2 * Math.PI * R; // 339.29…

/** Where in the scroll container the "currently reading" line sits. */
const READ_LINE = 0.34;

export function Trust() {
  const list = useRef<HTMLOListElement>(null);
  const [at, setAt] = useState(0);

  // Which row is at the read line. Recomputed on scroll and on resize,
  // because the rows reflow and a row index measured at one width is wrong
  // at another.
  useEffect(() => {
    const el = list.current;
    if (!el) return;

    const measure = () => {
      const line = el.getBoundingClientRect().top + el.clientHeight * READ_LINE;
      const rows = el.querySelectorAll<HTMLElement>('[data-check]');

      let nearest = 0;
      let best = Infinity;

      rows.forEach((row, i) => {
        const distance = Math.abs(row.getBoundingClientRect().top - line);
        if (distance < best) {
          best = distance;
          nearest = i;
        }
      });

      setAt(nearest);
    };

    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Let the page keep scrolling once the list is done. See the docblock.
  useEffect(() => {
    const el = list.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
      if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) return;
      e.stopPropagation();
    };

    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const cleared = at + 1;
  const active = CHECKS[at]!;
  const offset = CIRCUMFERENCE * (1 - cleared / CHECK_COUNT);

  return (
    <section
      id="trust"
      data-on-dark
      className="py-16 sm:py-20"
      style={{ background: 'var(--ink)', colorScheme: 'light' }}
    >
      <Wrap>
        <div className="mb-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div>
            <Eyebrow onDark>Why trust us</Eyebrow>
            <Heading className="max-w-[20ch] text-[#fcfcfa]">
              Six thousand studios in Pune. Fourteen got through.
            </Heading>
            <p className="m-0 mt-5 max-w-[56ch] text-[15px] leading-[1.65] text-white/70">
              We handpick, then verify. {CHECK_COUNT} mandatory checks, every one with a named
              verifier — scroll them and watch the count fill.
            </p>
          </div>

          {/* `whitespace-nowrap` per line: this broke into four ragged lines
              at tablet width and read as a paragraph rather than a stamp. */}
          <div className="text-left sm:text-right">
            <p className="oi-num m-0 whitespace-nowrap text-[10.5px] uppercase tracking-[0.18em] text-white/55">
              One failed check, not listed
            </p>
            <p className="oi-num m-0 mt-1 whitespace-nowrap text-[10.5px] uppercase tracking-[0.18em] text-white/55">
              until fixed and re-checked
            </p>
          </div>
        </div>

        <div
          className="grid gap-x-12 gap-y-10"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}
        >
          {/* ── The counter ── */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative h-[180px] w-[180px]">
              <svg
                width="180"
                height="180"
                viewBox="0 0 132 132"
                aria-hidden
                style={{ transform: 'rotate(-90deg)' }}
              >
                <circle
                  cx="66"
                  cy="66"
                  r={R}
                  fill="none"
                  stroke="rgba(252,252,250,.18)"
                  strokeWidth="5"
                />
                <circle
                  cx="66"
                  cy="66"
                  r={R}
                  fill="none"
                  stroke="var(--sec)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={offset}
                  className="oi-ring"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <span className="oi-num text-[44px] leading-none text-[#fcfcfa]">{cleared}</span>
                <span className="oi-num text-[10.5px] uppercase tracking-[0.18em] text-white/55">
                  of {CHECK_COUNT} cleared
                </span>
              </div>
            </div>

            <div className="mt-8">
              <p className="oi-num m-0 mb-2 text-[10.5px] uppercase tracking-[0.18em] text-white/55">
                Now reading
              </p>
              {/* Polite, not assertive: this changes on every scroll tick and
                  an assertive region would interrupt continuously. */}
              <p aria-live="polite" className="m-0">
                <span className="oi-display block text-[26px] text-[#fcfcfa]">{active.title}</span>
                <span
                  className="oi-num mt-2 block text-[10.5px] uppercase tracking-[0.18em]"
                  style={{ color: '#b9c4a9' }}
                >
                  Verified by {active.verifier}
                </span>
              </p>
            </div>

            <div className="mt-8">
              <Cta href="/quiz" intent="onDark">
                Find your designer
              </Cta>
            </div>
          </div>

          {/* ── The fifteen ── */}
          <ol
            ref={list}
            className="oi-rail m-0 list-none overflow-y-auto p-0"
            style={{ height: 'min(70vh,560px)' }}
          >
            {CHECKS.map((check, i) => (
              <li
                key={check.type}
                data-check
                className="oi-check-row border-t px-1 py-[22px]"
                style={{
                  borderColor: 'rgba(252,252,250,.16)',
                  // Cleared rows stay lit. See the docblock — this is the
                  // count made visible, not a fade.
                  //
                  // The handoff says .38 for unread rows. That renders the
                  // detail line at 2.33:1 on this ground, and these are
                  // fifteen paragraphs of real content, not a decorative
                  // backdrop — so the floor is .7 (4.56:1) instead. The
                  // read/unread distinction survives; it is just no longer
                  // made by pushing half the section below legibility.
                  opacity: i <= at ? 1 : 0.7,
                }}
              >
                <p className="m-0 mb-2.5 flex flex-wrap items-baseline gap-3">
                  <span
                    className="oi-num text-[10.5px] uppercase tracking-[0.16em]"
                    style={{ color: '#b9c4a9' }}
                  >
                    {check.n}
                  </span>
                  <span className="oi-num text-[10.5px] uppercase tracking-[0.16em] text-white/50">
                    {check.category}
                  </span>
                </p>

                <p className="m-0 mb-1.5 text-[17px] font-semibold text-[#fcfcfa]">{check.title}</p>
                <p className="m-0 max-w-[520px] text-[14.5px] leading-[1.55] text-white/[.68]">
                  {check.detail}
                </p>
                <p
                  className="oi-num m-0 mt-2.5 text-[9.5px] uppercase tracking-[0.16em]"
                  style={{ color: '#b9c4a9' }}
                >
                  Verified by {check.verifier}
                </p>
              </li>
            ))}

            {/* Lets the last check reach the read line, so the ring can
                actually fill. Without it the count stops at fourteen. */}
            <li aria-hidden style={{ height: 220 }} />
          </ol>
        </div>
      </Wrap>
    </section>
  );
}
