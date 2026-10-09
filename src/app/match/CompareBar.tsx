'use client';

/**
 * The compare bar.
 *
 * ## Hierarchy
 *
 * Three levels, left to right: the count (the fact), what it means (the
 * status), and the action. Previously all three were one sentence at one
 * size, so nothing led — you had to read it to find out whether you could
 * act. Now the count is a figure, the status is a line under it, and the
 * button is either there or it is not.
 *
 * ## Why it does not sit there disabled
 *
 * A greyed-out button is a puzzle: it says "no" without saying why. Below the
 * minimum the bar states what is missing in words and shows no button at all,
 * so there is nothing to press and nothing to wonder about.
 *
 * It only appears once something has been priced — an empty bar pinned to the
 * bottom of a screen with nothing in it is furniture.
 *
 * Dressed as the landing's nav once you scroll (owner, 10 Oct 2026): white
 * with a blur, a hairline shadow rather than a border, the action a dark pill.
 * `.cb cb-part` so the pill is styled wherever the bar is mounted.
 */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Pill } from '@/components/home/parts';
import { DUR, EASE_OUT } from '@/components/oi/motion';
import { Wrap } from '@/components/oi';
import { useSiteT } from '@/components/app/i18n';
import { MATCH_DICT } from '@/modules/i18n/site/match';

export function CompareBar({
  selected,
  minimum,
  priced,
}: {
  selected: number;
  minimum: number;
  priced: number;
}) {
  const reduced = useReducedMotion();
  const t = useSiteT(MATCH_DICT);
  const ready = selected >= minimum;

  return (
    <AnimatePresence>
      {priced > 0 ? (
        <motion.div
          initial={reduced ? false : { y: 70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? undefined : { y: 70, opacity: 0 }}
          transition={{ duration: DUR.bar, ease: EASE_OUT }}
          className="cb cb-part sticky bottom-0 z-20 print:hidden"
          style={{
            background: 'rgba(255,255,255,.82)',
            backdropFilter: 'saturate(1.4) blur(14px)',
            WebkitBackdropFilter: 'saturate(1.4) blur(14px)',
            boxShadow: '0 -1px 0 var(--line)',
            overflowX: 'visible',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <Wrap>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
              <div className="flex items-center gap-3.5">
                <span
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[17px] font-medium tabular-nums transition-colors duration-300"
                  style={{
                    background: ready ? 'var(--ink)' : 'var(--soft)',
                    color: ready ? '#fff' : 'var(--ink)',
                  }}
                >
                  {selected}
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[15px] font-medium leading-tight tracking-[-0.01em] text-[var(--ink)]">
                    {ready ? t('compare.ready') : t('compare.selected')}
                  </p>
                  <p className="m-0 mt-0.5 text-[13px] leading-snug text-[var(--ink-2)]">
                    {ready
                      ? t('compare.readyBody')
                      : t('compare.pick', { n: minimum - selected })}
                  </p>
                </div>
              </div>

              {ready ? (
                <Pill href="/compare" arrow>
                  {t('compare.cta', { n: selected })}
                </Pill>
              ) : null}
            </div>
          </Wrap>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
