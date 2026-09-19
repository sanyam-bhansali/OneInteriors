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
import { CountUp } from './CountUp';

export function MatchHero({
  fit,
  checkCount,
}: {
  /** How many studios cleared the brief. This is the "top N". */
  fit: number;
  checkCount: number;
}) {
  const reduced = useReducedMotion();

  const rise = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay: reduced ? 0 : delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <header className="mx-auto max-w-[46rem] pb-2 text-center">
      <motion.p {...rise(0)} className="oi-eyebrow q-eyebrow-lg m-0 mb-7">
        Who fits you
      </motion.p>

      <motion.p {...rise(0.06)} className="m-0 flex items-baseline justify-center gap-3">
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
        {...rise(0.14)}
        className="oi-display q-h1 m-0 mt-4 uppercase text-[var(--ink)]"
        style={{ letterSpacing: '0.02em' }}
      >
        Best fits for your brief.
      </motion.h1>

      {/* Directly below the number, as the footnote to it. */}
      <motion.p
        {...rise(0.22)}
        className="q-body mx-auto m-0 mt-6 max-w-[46ch] text-[var(--ink2)]"
      >
        Scored on your answers — locality, scope, budget band, style, household — and on how many
        of the {checkCount} checks they have cleared.
      </motion.p>
    </header>
  );
}
