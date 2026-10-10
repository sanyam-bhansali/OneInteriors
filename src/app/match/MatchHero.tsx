'use client';

/**
 * The anchor of the page.
 *
 * The count is the first thing the eye lands on and the only thing at that
 * size, so everything under it reads as support rather than competition. The
 * "scored on your answers" paragraph sits directly beneath, which is where it
 * belongs: it is the footnote to the number, not a separate idea.
 *
 * Set in the landing page's hero voice (owner, 10 Oct 2026): the name in the
 * small pill with the terracotta dot, the sentence as `.h-xl` whose words rise
 * in, the narrowing ("10 verified studios → 6 at Premium → 3 for you") as the
 * landing's small uppercase line, and the rest as the hero's sub-copy.
 *
 * "Nobody can pay to sit higher" was here and has been removed on request.
 * Worth noting for whoever reads this next: it is the one claim that separates
 * this from every other directory in the category, and a ranked list is
 * exactly where a reader wonders about it. It still appears on the landing
 * page; if it never returns to this screen, that is a deliberate choice rather
 * than an oversight.
 */

import { CountUp } from '@/components/oi/CountUp';
import { useSiteT } from '@/components/app/i18n';
import { MATCH_DICT } from '@/modules/i18n/site/match';

const delay = (ms: number) => ({ ['--d' as string]: `${ms}ms` });

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
  const t = useSiteT(MATCH_DICT);

  /* "Your top 5 matches." as the landing's split heading: each word rises
     in, and the count is one of the words — the only figure in the
     sentence, so it is the one that counts up. Built by hand rather than
     with <Split> because one of the words is a component. */
  const lead = t('hero.top').split(/\s+/).filter(Boolean);
  const tail = (fit === 1 ? t('hero.tail1') : t('hero.tailN')).split(/\s+/).filter(Boolean);
  const words: React.ReactNode[] = [
    ...lead,
    <CountUp key="n" to={fit} className="tabular-nums text-[var(--accent)]" label={fit === 1 ? t('hero.word1') : t('hero.wordN')} />,
    ...tail,
  ];
  const spoken = [...lead, String(fit), ...tail].join(' ');

  return (
    <header className="mx-auto flex max-w-[60rem] flex-col items-center pb-2 text-center">
      {/* Their name, when they gave it — the first thing the brief asked, and
          the first thing this page says back. */}
      <p className="hero-meta" data-reveal="" data-auto="">
        <i aria-hidden="true" />
        {name ? t('hero.welcome', { name }) : t('hero.whoFits')}
      </p>

      <h1 className="h-xl split" data-split="" data-auto="" aria-label={spoken}>
        {words.map((w, i) => (
          <span key={i} aria-hidden="true">
            <span className="w">
              <span className="wi" style={{ ['--i' as string]: i }}>
                {w}
              </span>
            </span>{' '}
          </span>
        ))}
      </h1>

      {reveal.length > 1 ? (
        <p
          className="eyebrow flex flex-wrap items-baseline justify-center gap-x-2"
          style={{ margin: '28px 0 0', ...delay(350) }}
          data-reveal=""
          data-auto=""
        >
          {reveal.map((st, i) => (
            <span key={st.label}>
              {i > 0 ? <span aria-hidden className="mr-2 text-[var(--accent)]">→</span> : null}
              <span className="tabular-nums text-[var(--ink)]">{st.count}</span> {st.label}
            </span>
          ))}
        </p>
      ) : null}

      {forWhat ? (
        <p className="hero-sub" style={{ marginTop: 18, color: 'var(--ink)', ...delay(450) }} data-reveal="" data-auto="">
          {t('hero.for', { what: forWhat })}
        </p>
      ) : null}

      {/* Directly below the number, as the footnote to it.

          It must name only what the engine reads. It used to say "household"
          and "how many of the checks they have cleared" — neither is scored:
          the household is passed to the studio, and verification is a filter
          (only verified studios appear), not a factor. Nor is it "all fifteen":
          a LISTED studio has cleared five. Each card lists its own checks, so
          the footnote points there rather than quoting a number that is true
          of some cards and not others. */}
      <p
        className="m-0 mt-4 max-w-[48ch] text-[15px] leading-[1.6] text-[var(--ink-2)]"
        style={delay(550)}
        data-reveal=""
        data-auto=""
      >
        {t('hero.footnote')}
      </p>
    </header>
  );
}
