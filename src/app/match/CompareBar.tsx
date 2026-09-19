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
 */

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { DUR, EASE_OUT } from '@/components/oi/motion';
import { Wrap } from '@/components/oi';

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
  const ready = selected >= minimum;

  return (
    <AnimatePresence>
      {priced > 0 ? (
        <motion.div
          initial={reduced ? false : { y: 70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? undefined : { y: 70, opacity: 0 }}
          transition={{ duration: DUR.bar, ease: EASE_OUT }}
          className="sticky bottom-0 z-20 border-t border-[var(--line)]"
          style={{
            background: 'rgba(252,252,250,.82)',
            backdropFilter: 'blur(20px) saturate(1.1)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.1)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <Wrap>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3.5">
              <div className="flex items-center gap-3.5">
                <span
                  className="oi-num flex h-11 w-11 flex-none items-center justify-center rounded-full text-[17px] font-bold"
                  style={{
                    background: ready ? 'var(--acc-wash)' : 'transparent',
                    border: `1px solid ${ready ? 'var(--acc)' : 'var(--line)'}`,
                    color: ready ? 'var(--acc-ink)' : 'var(--ink2)',
                  }}
                >
                  {selected}
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[14.5px] font-semibold leading-tight text-[var(--ink)]">
                    {ready ? 'Ready to compare' : 'Selected'}
                  </p>
                  <p className="q-small m-0 text-[var(--ink2)]">
                    {ready
                      ? 'Every line side by side, with the materials'
                      : `Pick ${minimum - selected} more to put them side by side`}
                  </p>
                </div>
              </div>

              {ready ? (
                <Link
                  href="/compare"
                  className="oi-cta inline-flex min-h-11 items-center px-6 py-3 text-[14.5px] no-underline"
                >
                  Compare {selected}
                </Link>
              ) : null}
            </div>
          </Wrap>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
