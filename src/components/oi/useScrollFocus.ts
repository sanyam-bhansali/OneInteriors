'use client';

/**
 * Depth of field down a list.
 *
 * Whatever sits near the middle of the viewport is `near`; everything else is
 * `far` and recedes. The CSS does the fading and the 1.4px blur — this hook
 * only decides which is which, so the visual treatment can change without
 * touching any measurement logic.
 *
 * ## Why an observer and not a scroll listener
 *
 * A scroll handler runs on every frame of every scroll and has to read layout
 * to do anything useful, which is a forced reflow per frame on a list of
 * cards that are already being blurred. `IntersectionObserver` fires only
 * when a card crosses the band and costs nothing in between.
 *
 * The band is the middle 50% of the viewport — `rootMargin: -25% 0px`. Wide
 * enough that two cards can be in focus at once on a laptop, which is right:
 * on a screen showing three cards, blurring everything but one is seasick.
 *
 * ## `open` is a different question from `focus`
 *
 * Both track the same band, and they are separate for one reason: `focus`
 * starts at `near` for every card, because the depth-of-field blur is
 * decoration and a card must be readable before any observer has run. The
 * wings are the opposite — they must start shut, or every card on screen
 * flashes its wings open at first paint and snaps them closed a frame later
 * when the observer reports.
 *
 * So `open` starts `false` for everything and is driven only by the observer.
 * It does NOT latch. Scroll a studio away and its wings retract; scroll back
 * and they open again. They are a drawer, not a reveal.
 *
 * ## Reduced motion
 *
 * Returns everything `near` and everything `open`, and never observes
 * anything. The blur is decoration; the content underneath is not, and
 * somebody who asked the OS for less motion should not have to scroll a card
 * into a band to read it — nor hover one to see a studio's work.
 */

import { useEffect, useRef, useState } from 'react';

export type Focus = 'near' | 'far';

export function useScrollFocus<T extends HTMLElement>(count: number) {
  const refs = useRef<(T | null)[]>([]);
  const [focus, setFocus] = useState<Focus[]>(() => Array(count).fill('near'));
  const [open, setOpen] = useState<boolean[]>(() => Array(count).fill(false));

  useEffect(() => {
    setFocus((prev) =>
      prev.length === count ? prev : (Array(count).fill('near') as Focus[]),
    );
    setOpen((prev) => (prev.length === count ? prev : Array(count).fill(false)));
  }, [count]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    /* No observer and no motion both mean the same thing here: show
       everything, immediately, without animating it. Anything less would hide
       a studio's work behind a scroll gesture that will never be detected. */
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || !('IntersectionObserver' in window)) {
      setOpen(Array(count).fill(true));
      return;
    }

    const nodes = refs.current.filter((n): n is T => n !== null);
    if (nodes.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        setFocus((prev) => {
          const next = [...prev];
          let changed = false;
          for (const entry of entries) {
            const i = nodes.indexOf(entry.target as T);
            if (i === -1) continue;
            const value: Focus = entry.isIntersecting ? 'near' : 'far';
            if (next[i] !== value) {
              next[i] = value;
              changed = true;
            }
          }
          return changed ? next : prev;
        });

        // Not latched — it closes again on the way out.
        setOpen((prev) => {
          const next = [...prev];
          let changed = false;
          for (const entry of entries) {
            const i = nodes.indexOf(entry.target as T);
            if (i === -1 || next[i] === entry.isIntersecting) continue;
            next[i] = entry.isIntersecting;
            changed = true;
          }
          return changed ? next : prev;
        });
      },
      { rootMargin: '-25% 0px -25% 0px', threshold: 0 },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [count]);

  const register = (i: number) => (el: T | null) => {
    refs.current[i] = el;
  };

  return { register, focus, open };
}
