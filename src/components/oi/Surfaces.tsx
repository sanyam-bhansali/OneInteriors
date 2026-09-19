'use client';

/**
 * The reusable surfaces — glass, drawers, pills.
 *
 * Extracted from `/match`, which remains the reference implementation. See
 * docs/DESIGN-LANGUAGE.md §3 for what each is and §1.1 for the test any new
 * one has to pass.
 *
 * ## What is here and what is deliberately not
 *
 * These wrap CSS that already exists in globals.css. They are thin on
 * purpose: their job is to make the *contract* hard to get wrong — which
 * element carries `data-open`, which layer a drawer belongs to, that a pill
 * is always a tick plus a short line — not to hide the CSS.
 *
 * There is no `<Plate>` here. A portfolio plate is a photograph, a title and
 * a cost, which is `/match` content rather than a surface; it stays in
 * ProjectWings.tsx. The line is: if another page would put different content
 * in it, it belongs here; if another page would need a different component
 * entirely, it does not.
 */

import type { CSSProperties, ReactNode } from 'react';

/**
 * A card in glass.
 *
 * `focus` drives the depth-of-field: whatever the reader is looking at comes
 * forward, everything else recedes. Pass it from `useScrollFocus`, or leave
 * it off for a card that is not in a scrolling list.
 *
 * The element does NOT take an entrance animation. That is not an oversight —
 * see docs §2.5: Framer Motion writes `transform` inline and beats the class
 * rules that do the zoom and lift here, so the entrance belongs on a wrapper
 * element and this one owns the transform.
 */
export function Glass({
  children,
  focus,
  className = '',
  padded = true,
  style,
}: {
  children: ReactNode;
  focus?: 'near' | 'far';
  className?: string;
  /** Off for a card that lays out its own edge-to-edge content. */
  padded?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      data-focus={focus}
      style={style}
      className={`oi-pane ${padded ? 'p-[clamp(20px,2.6vw,28px)]' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The drawer host, as props to spread.
 *
 * Use this rather than `<Reveal>` when the host element is a `motion.*` — and
 * it often is, because the host is usually the card, and the card usually has
 * an entrance animation. `<Reveal>` cannot wrap a `motion.li` without adding
 * a second element, and a second element is the one thing §2.5 says not to do
 * here: the entrance and the transform must stay on separate elements, and
 * adding a third only moves the collision.
 *
 * ```tsx
 * <motion.li {...revealProps(wingsOpen)} {...riseCard(reduced, rank)}>
 * ```
 */
export function revealProps(open?: boolean, className = '') {
  return {
    className: `oi-wings ${className}`.trim(),
    'data-open': open ? ('yes' as const) : ('no' as const),
  };
}

/**
 * The host for drawers — hover target, focus target, and the element that
 * says whether the drawers are open.
 *
 * Everything that slides out must be a descendant of this, because the CSS
 * opens on `.oi-wings:hover`, `.oi-wings:focus-within` and
 * `.oi-wings[data-open='yes']`.
 *
 * `as` exists because the host is usually a semantic element already — the
 * `<li>` of a list, a `<section>` — and wrapping one in a div to get a hover
 * target is how a list stops being a list for a screen reader.
 */
export function Reveal({
  children,
  open,
  as: Tag = 'div',
  className = '',
}: {
  children: ReactNode;
  /**
   * Usually the card's entry from `useScrollFocus`. Hover and keyboard focus
   * open the drawers regardless, so this is the scroll trigger only.
   */
  open?: boolean;
  as?: 'div' | 'li' | 'section' | 'article';
  className?: string;
}) {
  return <Tag {...revealProps(open, className)}>{children}</Tag>;
}

/**
 * A panel that slides out from behind the card.
 *
 * `layer` is which of the two columns it occupies. `'near'` sits immediately
 * beside the card and appears at 1280px; `'far'` sits outside that one and
 * appears at 1440px. There is no third layer — the arithmetic in globals.css
 * runs out, and a fourth column has nowhere to go on any screen we support.
 *
 * Give it a `label` unless the content is already labelled by something
 * inside it: these are revealed on hover, and a screen reader user meets them
 * with no such cue.
 */
export function Drawer({
  children,
  side,
  layer = 'near',
  label,
  as: Tag = 'aside',
  className = '',
}: {
  children: ReactNode;
  side: 'left' | 'right';
  layer?: 'near' | 'far';
  label?: string;
  as?: 'aside' | 'ul' | 'div';
  className?: string;
}) {
  const base = layer === 'far' ? 'oi-drawer-far' : 'oi-drawer';
  const hand = `${base}-${side === 'left' ? 'l' : 'r'}`;

  return (
    <Tag className={`${base} ${hand} ${className}`} aria-label={label}>
      {children}
    </Tag>
  );
}

/**
 * The tick. A shape as well as a colour, per docs §4.4 — roughly 8% of men
 * cannot separate green from red, so the check mark carries the meaning and
 * the disc behind it only seats it.
 */
export function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="oi-tick" aria-hidden focusable="false">
      <circle cx="8" cy="8" r="7.25" />
      <path d="M4.6 8.3 L6.9 10.6 L11.4 5.6" />
    </svg>
  );
}

/**
 * A pill in Apple glass — a tick and a short line.
 *
 * `i` is its position within its own column, and the CSS turns it into a
 * delay. Each column indexes from zero, which is what makes two columns count
 * in together rather than one after the other.
 *
 * Keep `text` to 18 characters. It does not wrap — it ellipsises silently,
 * and a truncated claim is worse than a shorter one. `title` carries the long
 * form, so nothing is lost.
 */
export function Pill({
  text,
  i,
  title,
  as: Tag = 'li',
}: {
  text: string;
  i: number;
  title?: string;
  as?: 'li' | 'div';
}) {
  return (
    <Tag className="oi-pill" style={{ '--i': i } as CSSProperties} title={title}>
      <Tick />
      <span className="oi-pill-text">{text}</span>
    </Tag>
  );
}

/**
 * The line under a run of pills that says what they are not.
 *
 * Required whenever the pills are a subset — docs §1.3. Eight ticks beside a
 * card read as "eight checks exist" unless something on the same screen says
 * otherwise, and this is that something. It is not decoration and does not get
 * dropped for space.
 */
export function PillNote({
  children,
  i,
  as: Tag = 'li',
}: {
  children: ReactNode;
  /** Usually the number of pills above it, so it lands last. */
  i: number;
  as?: 'li' | 'p';
}) {
  return (
    <Tag className="oi-pill-note" style={{ '--i': i } as CSSProperties}>
      {children}
    </Tag>
  );
}
