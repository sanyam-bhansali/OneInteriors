'use client';

/**
 * The anchor of the page.
 *
 * The count is the first thing the eye lands on and the only thing at that
 * size, so everything under it reads as support rather than competition. The
 * "scored on your answers" paragraph sits directly beneath, which is where it
 * belongs: it is the footnote to the number, not a separate idea.
 *
 * "Nobody can pay to sit higher" was here and has been removed on request.
 * Worth noting for whoever reads this next: it is the one claim that separates
 * this from every other directory in the category, and a ranked list is
 * exactly where a reader wonders about it. It still appears on the landing
 * page; if it never returns to this screen, that is a deliberate choice rather
 * than an oversight.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { rise } from '@/components/oi/motion';
import { CountUp } from '@/components/oi/CountUp';

export function MatchHero({
  fit,
}: {
  /** How many studios cleared the brief. This is the "top N". */
  fit: number;
}) {
  const reduced = useReducedMotion();

  return (
    <header className="mx-auto max-w-[46rem] pb-2 text-center">
      <motion.p {...rise(reduced, 0)} className="oi-eyebrow q-eyebrow-lg m-0 mb-7">
        Who fits you
      </motion.p>

      <motion.p {...rise(reduced, 0.06)} className="m-0 flex items-baseline justify-center gap-3">
        <span className="oi-display q-h1 uppercase text-[var(--ink2)]" aria-hidden>
          Top
        </span>
        <CountUp
          to={fit}
          className="oi-num q-hero text-[var(--ink)]"
          label={`top ${fit} best fits for your brief`}
        />
      </motion.p>

      {/* Uppercase, with the tracking opened up — caps set at display tracking
          close into a solid block and stop reading as words. */}
      <motion.h1
        {...rise(reduced, 0.14)}
        className="oi-display q-h1 m-0 mt-4 uppercase text-[var(--ink)]"
        style={{ letterSpacing: '0.02em' }}
      >
        Best fits for your brief.
      </motion.h1>

      {/* Directly below the number, as the footnote to it.

          It must name only what the engine reads. It used to say "household"
          and "how many of the checks they have cleared" — neither is scored:
          the household is passed to the studio, and verification is a filter
          (only verified studios appear), not a factor. Nor is it "all fifteen":
          a LISTED studio has cleared five. Each card lists its own checks, so
          the footnote points there rather than quoting a number that is true
          of some cards and not others. */}
      <motion.p
        {...rise(reduced, 0.22)}
        className="q-body mx-auto m-0 mt-6 max-w-[46ch] text-[var(--ink2)]"
      >
        Ranked on your answers — your area, budget band, scope and the styles you chose. Every
        studio here has cleared our checks; each card shows which.
      </motion.p>
    </header>
  );
}
