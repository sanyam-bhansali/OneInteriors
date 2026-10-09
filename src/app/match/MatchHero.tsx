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
import { useSiteT } from '@/components/app/i18n';
import { MATCH_DICT } from '@/modules/i18n/site/match';

export function MatchHero({
  fit,
  name,
  forWhat,
  reveal = [],
}: {
  /** How many studios cleared the brief. This is the "top N". */
  fit: number;
  /** The name they gave on the brief's first screen, if any. */
  name?: string | null;
  /** "your 3 BHK in Kharadi · Premium" — what these are the best fits for. */
  forWhat?: string | null;
  /** "10 verified studios → 6 at Premium → 3 for you" (queue item 15), already in the visitor's language. */
  reveal?: { count: number; label: string }[];
}) {
  const reduced = useReducedMotion();
  const t = useSiteT(MATCH_DICT);

  return (
    <header className="mx-auto max-w-[46rem] pb-2 text-center">
      {/* Their name, when they gave it — the first thing the brief asked, and
          the first thing this page says back. */}
      <motion.p {...rise(reduced, 0)} className="oi-eyebrow q-eyebrow-lg m-0 mb-7">
        {name ? t('hero.welcome', { name }) : t('hero.whoFits')}
      </motion.p>

      {/* One sentence, set large: "Your top 5 matches." The count is the
          only figure in it, so it is the one that counts up. */}
      <motion.h1
        {...rise(reduced, 0.06)}
        className="oi-display m-0 text-[clamp(2.6rem,1.4rem+5vw,5.4rem)] leading-[0.98] text-[var(--ink)]"
      >
        {t('hero.top')} <CountUp to={fit} className="tabular-nums text-[var(--acc)]" label={fit === 1 ? t('hero.word1') : t('hero.wordN')} />
        <span aria-hidden> {fit === 1 ? t('hero.tail1') : t('hero.tailN')}</span>
      </motion.h1>

      {reveal.length > 1 ? (
        <motion.p
          {...rise(reduced, 0.16)}
          className="oi-mono m-0 mt-6 flex flex-wrap items-baseline justify-center gap-x-2 text-[13px] uppercase tracking-[0.1em] text-[var(--ink2)]"
        >
          {reveal.map((st, i) => (
            <span key={st.label}>
              {i > 0 ? <span aria-hidden className="mr-2 text-[var(--acc)]">→</span> : null}
              <strong className="text-[var(--ink)]">{st.count}</strong> {st.label}
            </span>
          ))}
        </motion.p>
      ) : null}

      {forWhat ? (
        <motion.p {...rise(reduced, 0.18)} className="q-body m-0 mt-3 text-[var(--ink)]">
          {t('hero.for', { what: forWhat })}
        </motion.p>
      ) : null}

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
        {t('hero.footnote')}
      </motion.p>
    </header>
  );
}
