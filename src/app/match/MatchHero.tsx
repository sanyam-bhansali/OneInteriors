'use client';

/**
 * The anchor of the page.
 *
 * The count is the first thing the eye lands on and the only thing at that
 * size, so everything under it reads as support rather than competition. The
 * "scored on your answers" paragraph sits directly beneath, which is where it
 * belongs: it is the footnote to the number, not a separate idea.
 *
 * "Nobody can pay to sit higher" stays on this screen. It is the single claim
 * that separates this from every other directory in the category, and the
 * moment somebody sees a ranked list is the moment it has to be said.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { CountUp } from './CountUp';

export function MatchHero({
  fit,
  roster,
  checkCount,
}: {
  /** How many studios cleared the brief. */
  fit: number;
  /** How many are on the roster in total. */
  roster: number;
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
      <motion.p {...rise(0)} className="oi-eyebrow m-0 mb-6">
        Who fits you
      </motion.p>

      <motion.p {...rise(0.06)} className="m-0 flex items-baseline justify-center gap-3">
        <CountUp
          to={fit}
          className="oi-num q-hero text-[var(--ink)]"
          label={`of ${roster} studios fit your brief`}
        />
        <span className="oi-display q-h1 text-[var(--ink2)]" aria-hidden>
          of {roster}
        </span>
      </motion.p>

      <motion.h1 {...rise(0.14)} className="oi-display q-h1 m-0 mt-4 text-[var(--ink)]">
        fit your brief.
      </motion.h1>

      {/* Directly below the number, as the footnote to it. */}
      <motion.p
        {...rise(0.22)}
        className="q-body mx-auto m-0 mt-6 max-w-[46ch] text-[var(--ink2)]"
      >
        Scored on your answers — locality, scope, budget band, style, household — and on how many
        of the {checkCount} checks they have cleared.
      </motion.p>

      <motion.p {...rise(0.3)} className="oi-label m-0 mt-6">
        Nobody can pay to sit higher
      </motion.p>
    </header>
  );
}
