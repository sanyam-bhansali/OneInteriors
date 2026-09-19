/**
 * The motion vocabulary — one source for every curve and delay.
 *
 * These numbers were literals repeated across MatchHero, StudioCard,
 * CompareBar, CountUp and four places in globals.css. That is how a product
 * ends up with three eases that are almost the same and a stagger that is
 * 60ms on one screen and 80ms on the next: nobody chose differently, the
 * second screen was simply written from memory.
 *
 * See docs/DESIGN-LANGUAGE.md §2 for why each is what it is. The short
 * version: three motions exist — rise, drawer, count — and a new screen
 * composes them rather than inventing a fourth.
 *
 * ## Nothing here overshoots
 *
 * Every curve decelerates into its final value and none pass through it.
 * From CountUp, and it generalises to every figure in the product: an
 * overshoot briefly displays a number that is not true.
 *
 * ## This file is pure
 *
 * No 'use client', no React, no framer-motion import — just values and two
 * plain functions. So a server component can read a duration, and the tests
 * can import it without pulling a renderer in. Per CONTRIBUTING §9.5.
 */

/** Entrances and reveals. Decelerating, no overshoot. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** A drawer sliding out. Slightly softer landing than EASE_OUT. */
export const EASE_DRAWER_OUT = [0.2, 0.85, 0.25, 1] as const;

/** A drawer closing. Leaves quickly — see DUR.close. */
export const EASE_DRAWER_IN = [0.4, 0, 0.2, 1] as const;

/** The card lift and scale. */
export const EASE_LIFT = [0.2, 0.8, 0.2, 1] as const;

export const DUR = {
  /** One element rising into place. */
  rise: 0.55,
  /** A card's entrance in a list. */
  card: 0.5,
  /** A drawer opening. */
  open: 0.5,
  /**
   * A drawer closing. Deliberately shorter than `open`: a drawer that takes
   * as long to shut as it did to open feels stuck rather than considered.
   */
  close: 0.32,
  /** A disclosure expanding in place. */
  expand: 0.3,
  /** A sticky bar arriving from the edge. */
  bar: 0.38,
  /** A figure counting to its value. */
  count: 1.2,
} as const;

export const STAGGER = {
  /**
   * Between cards in a list.
   *
   * Always capped — see `stagger()`. Uncapped, the ninth card waits 540ms and
   * the list reads as broken rather than as choreographed.
   */
  card: 0.06,
  /** Between items inside one group, opening. */
  item: 0.09,
  /** Between items inside one group, closing. Quicker, per DUR.close. */
  itemClose: 0.04,
  /** Held back so the layer beneath has landed first. */
  afterSurface: 0.26,
} as const;

/** How many items still earn their own delay before everything shares the last one. */
export const STAGGER_CAP = 5;

/**
 * The delay for item `i`, capped.
 *
 * ```ts
 * transition={{ delay: stagger(rank) }}
 * ```
 */
export function stagger(i: number, step: number = STAGGER.card): number {
  return Math.min(i, STAGGER_CAP) * step;
}

/**
 * The rise — the entrance every element in this product uses.
 *
 * Spread onto a `motion.*` element. `reduced` comes from framer-motion's
 * `useReducedMotion()`, which is a hook, so it is passed in rather than read
 * here — this file stays pure.
 *
 * ```tsx
 * const reduced = useReducedMotion();
 * <motion.p {...rise(reduced, 0.14)}>…</motion.p>
 * ```
 *
 * `initial: false` rather than a zero-distance animation is the correct
 * reduced-motion form: it tells framer-motion to paint the final state and
 * skip the transition entirely, instead of running a tween that happens to
 * move nothing.
 */
export function rise(reduced: boolean | null, delay = 0) {
  return {
    initial: reduced ? (false as const) : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: DUR.rise,
      delay: reduced ? 0 : delay,
      ease: EASE_OUT,
    },
  };
}

/**
 * The same, for a card at position `rank` in a list.
 *
 * A shorter duration and a smaller distance than `rise`: a list of eight
 * cards each travelling 14px over 0.55s reads as the whole page sliding.
 */
export function riseCard(reduced: boolean | null, rank: number) {
  return {
    initial: reduced ? (false as const) : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: DUR.card,
      delay: reduced ? 0 : stagger(rank),
      ease: EASE_OUT,
    },
  };
}
