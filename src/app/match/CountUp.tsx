'use client';

/**
 * A number that arrives rather than appears.
 *
 * ## The one rule that makes this safe
 *
 * The accessible name is the FINAL value from the first frame. A screen
 * reader that follows the animation announces "zero, one, two, three…" into
 * somebody's ear, and an `aria-live` region here would be actively hostile.
 * So the rolling digits are `aria-hidden` and a visually hidden span carries
 * the real figure, which is also what a page-scrape or a printed page gets.
 *
 * Under `prefers-reduced-motion` the final value is painted immediately —
 * no tween, no delay, nothing to wait through.
 */

import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

export function CountUp({
  to,
  duration = 1.2,
  className = '',
  /** What the number means, for the accessible label. */
  label,
}: {
  to: number;
  duration?: number;
  className?: string;
  label: string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? to : 0);
  /** So a re-render mid-tween does not restart the count. */
  const ran = useRef(false);

  useEffect(() => {
    if (reduced) {
      setShown(to);
      return;
    }
    if (ran.current) {
      setShown(to);
      return;
    }
    ran.current = true;

    const controls = animate(0, to, {
      duration,
      // Decelerating, and nothing bouncier: this is a count, not a toy, and
      // an overshoot would briefly show a number that is not true.
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [to, duration, reduced]);

  return (
    <span className={className}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">
        {to} {label}
      </span>
    </span>
  );
}
