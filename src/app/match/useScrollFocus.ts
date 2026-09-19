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
 * ## Reduced motion
 *
 * Returns everything `near` and never observes anything. The blur is
 * decoration; the content underneath is not, and somebody who asked the OS
 * for less motion should not have to scroll a card into a band to read it.
 */

import { useEffect, useRef, useState } from 'react';

export type Focus = 'near' | 'far';

export function useScrollFocus<T extends HTMLElement>(count: number) {
  const refs = useRef<(T | null)[]>([]);
  const [focus, setFocus] = useState<Focus[]>(() => Array(count).fill('near'));

  useEffect(() => {
    setFocus((prev) =>
      prev.length === count ? prev : (Array(count).fill('near') as Focus[]),
    );
  }, [count]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // No IntersectionObserver (old browser, some test environments) means no
    // effect and no error — everything simply stays in focus.
    if (!('IntersectionObserver' in window)) return;

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
      },
      { rootMargin: '-25% 0px -25% 0px', threshold: 0 },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [count]);

  const register = (i: number) => (el: T | null) => {
    refs.current[i] = el;
  };

  return { register, focus };
}
