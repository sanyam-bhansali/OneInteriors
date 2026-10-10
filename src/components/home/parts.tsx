/**
 * The landing page's building blocks, shared with the customer flow from the
 * quiz to the expert call (owner, 10 Oct 2026: "the design … on our landing
 * page should be in the quiz too, in the brief too and till the expert page").
 *
 * Every class here is styled in `home-cb.css` under `.cb`, so these render
 * correctly anywhere inside a `.cb` root — the home page, or `FlowShell`.
 * No hooks: safe in server and client components alike.
 */

import Link from 'next/link';

/** A heading whose words rise into place when it scrolls in (`.split`). */
export function Split({
  as: Tag = 'h2',
  text,
  className = '',
  id,
  auto = false,
}: {
  as?: 'h1' | 'h2' | 'h3';
  text: string;
  className?: string;
  id?: string;
  /** Rise on load rather than on scroll — for the first heading on a screen. */
  auto?: boolean;
}) {
  const words = text.split(/\s+/);
  return (
    <Tag className={`${className} split`} id={id} data-split="" data-auto={auto ? '' : undefined} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true">
          <span className="w">
            <span className="wi" style={{ ['--i' as string]: i }}>
              {w}
            </span>
          </span>{' '}
        </span>
      ))}
    </Tag>
  );
}

export const Arrow = () => (
  <span className="pill-arrow" aria-hidden="true">
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
      <path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

type Tone = 'dark' | 'light' | 'line' | 'accent';
type Size = 'sm' | 'lg';

function pillClass(tone: Tone, size?: Size, extra = '') {
  return `pill pill-${tone}${size ? ` pill-${size}` : ''}${extra ? ` ${extra}` : ''}`;
}

function PillInner({ children, arrow }: { children: string; arrow: boolean }) {
  return (
    <span className="mag-inner">
      <span className="roll">
        <span data-t={children}>{children}</span>
      </span>
      {arrow ? <Arrow /> : null}
    </span>
  );
}

/** A pill link whose label rolls up on hover and whose fill rises from below. */
export function Pill({
  href,
  children,
  tone = 'dark',
  arrow = false,
  size,
  className = '',
}: {
  href: string;
  children: string;
  tone?: Tone;
  arrow?: boolean;
  size?: Size;
  className?: string;
}) {
  const cls = pillClass(tone, size, className);
  return href.startsWith('#') || href.startsWith('mailto:') ? (
    <a className={cls} href={href} data-magnetic="">
      <PillInner arrow={arrow}>{children}</PillInner>
    </a>
  ) : (
    <Link className={cls} href={href} data-magnetic="">
      <PillInner arrow={arrow}>{children}</PillInner>
    </Link>
  );
}

/** The same pill as a button, for forms and steps. */
export function PillButton({
  children,
  tone = 'dark',
  arrow = false,
  size,
  className = '',
  type = 'button',
  disabled,
  onClick,
}: {
  children: string;
  tone?: Tone;
  arrow?: boolean;
  size?: Size;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type={type} className={pillClass(tone, size, className)} disabled={disabled} onClick={onClick} data-magnetic="">
      <PillInner arrow={arrow}>{children}</PillInner>
    </button>
  );
}
