'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Fades and lifts its children in when they scroll into view. Once.
 *
 * ## Why this and not the existing `Reveal`
 *
 * `Reveal` in Surfaces.tsx is a different thing that happens to share a
 * word: it opens the side drawers on a /match card and is driven by
 * `useScrollFocus`, which tracks which card is CENTRED and closes the
 * others again. This one is an entrance — it fires once on the way in
 * and then gets out of the way permanently.
 *
 * ## Why an observer rather than a CSS animation
 *
 * The hero can use a plain CSS animation because it is on screen at
 * load. Everything below the fold cannot: a CSS animation runs
 * immediately, so by the time somebody scrolls down the section has
 * already finished animating and simply appears. The effect is invisible
 * and the cost is real — content that starts at `opacity: 0` and relies
 * on an animation to arrive is content that never arrives if anything
 * goes wrong.
 *
 * Which is why the observer only ever ADDS a class. Before it fires the
 * element is at `opacity: 0` **via a class that is only applied once the
 * observer is known to be running** — so with JavaScript off, a failed
 * hydration, or no IntersectionObserver, everything is simply visible.
 * An animation must never be load-bearing for whether words can be read.
 *
 * ## Once, and then disconnected
 *
 * `unobserve` on the first intersection. A section that re-animates when
 * you scroll back up feels broken rather than polished, and an observer
 * left running per card is work the browser does for nothing.
 */
export function ScrollReveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  /**
   * Stagger, in milliseconds. Keep it under ~400 total across a group —
   * past that the last item reads as late rather than as sequenced.
   */
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'section' | 'article';
}) {
  const ref = useRef<HTMLElement | null>(null);
  /**
   * Starts false, which means no hidden class on the server render and
   * on the first paint. The element is visible until this component has
   * proved it can animate it back in.
   */
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Somebody who has asked for less motion gets none, and gets it
    // without a flash of hidden content first.
    if (
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setShown(true);
      return;
    }

    // Already on screen when we mount — above the fold, or a reload
    // partway down the page. Show it without the entrance, because an
    // element animating in while you are already looking at it reads as
    // a glitch.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.85) {
      setShown(true);
      return;
    }

    setArmed(true);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          /**
           * `isIntersecting` OR already scrolled past.
           *
           * IntersectionObserver reports intersection at the moment it
           * samples. A page jumped from the hero to the footer — an
           * anchor link, a restored scroll position, End — can move an
           * element from below the viewport to above it between two
           * samples, so it is never observed inside. The element would
           * then sit at `opacity: 0` for the rest of the session.
           *
           * `boundingClientRect.top < 0` means "it is above us now",
           * which is as good a reason to show it as being inside.
           */
          if (!entry.isIntersecting && entry.boundingClientRect.top >= 0) continue;
          setShown(true);
          observer.unobserve(entry.target);
        }
      },
      // A little before the edge, so the motion finishes about when the
      // element reaches a comfortable reading position rather than
      // starting there.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );

    observer.observe(node);

    /**
     * The deadline. If nothing has fired in three seconds, show it.
     *
     * IntersectionObserver callbacks are delivered on rendering frames,
     * so anything that stops a page producing frames — an occluded
     * window, a throttled background tab, a headless capture, an
     * embedded webview — stops reveals firing while the page still
     * reports itself visible. Found the hard way: in a browser pane that
     * was not painting, `requestAnimationFrame` never ran and every
     * reveal on this page sat at `opacity: 0` indefinitely.
     *
     * That is the exact failure the whole component is written to avoid,
     * and an observer alone cannot avoid it, because the observer is
     * downstream of the thing that broke. A timer is not.
     *
     * Three seconds: long enough that a real scroll always wins and the
     * entrance is never skipped for somebody reading normally, short
     * enough that nobody stares at a blank section.
     */
    const deadline = window.setTimeout(() => setShown(true), 3000);

    return () => {
      window.clearTimeout(deadline);
      observer.disconnect();
    };
  }, []);

  return (
    <Tag
      /* A callback ref rather than passing `ref` straight through. `Tag`
         is one of four element types, so React's ref type collapses to
         the INTERSECTION of HTMLDivElement, HTMLLIElement and the rest —
         a type nothing satisfies. A callback takes the common base and
         stores it, which is all this component needs. */
      ref={(node: HTMLElement | null) => {
        ref.current = node;
      }}
      className={`${armed ? 'oi-enter' : ''} ${shown ? 'oi-enter-in' : ''} ${className}`}
      style={shown && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
