/**
 * The small pieces the landing page is made of.
 *
 * Server components, all of them — nothing here holds state. They exist so the
 * page file reads as a sequence of sections rather than four hundred lines of
 * Tailwind, and so the section language stays consistent: mono eyebrow, serif
 * heading, sans body, squared corners except on glass.
 *
 * Colours come from the `.oi-landing` token block in `globals.css` and never
 * from a literal hex. The one rule that matters: `--acc` (terracotta) is for
 * high-intent actions and attention flags ONLY. A terracotta rule or a
 * terracotta hover state costs the button its meaning.
 */

import Link from 'next/link';

export function Section({
  children,
  className = '',
  dark = false,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  /** Deep Espresso ground, for the film and trust bands. */
  dark?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`${dark ? 'bg-[var(--ink)] text-[#efeae2]' : ''} ${className}`}
      style={dark ? { colorScheme: 'light' } : undefined}
    >
      {children}
    </section>
  );
}

/** One measure, one gutter, everywhere on the page. */
export function Wrap({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-[1180px] px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function Eyebrow({
  children,
  onDark = false,
}: {
  children: React.ReactNode;
  onDark?: boolean;
}) {
  return (
    <p className="oi-eyebrow m-0 mb-4" style={onDark ? { color: '#d99368' } : undefined}>
      {children}
    </p>
  );
}

/** Serif, tight, and never more than two lines at display size. */
export function Heading({
  children,
  className = '',
  as: Tag = 'h2',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <Tag className={`oi-display m-0 text-[clamp(1.75rem,1.1rem+2.1vw,2.6rem)] ${className}`}>
      {children}
    </Tag>
  );
}

/**
 * The one high-intent action.
 *
 * `intent="quote"` is terracotta and there should be at most one of it per
 * viewport. Everything else is a quiet button — if two things on a screen are
 * both the primary action, neither is.
 */
export function Cta({
  href,
  children,
  intent = 'quote',
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  intent?: 'quote' | 'quiet' | 'onDark' | 'onAccent';
  className?: string;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 px-6 py-3.5 text-[14.5px] font-medium no-underline transition-colors';

  const skin = {
    quote: 'bg-[var(--acc-btn)] text-white hover:bg-[#a95233]',
    quiet: 'border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] hover:border-[var(--ink2)]',
    onDark: 'border border-white/25 text-[#efeae2] hover:border-white/60',
    onAccent: 'bg-[var(--card)] text-[var(--ink)] hover:bg-white',
  }[intent];

  return (
    <Link href={href} className={`${base} ${skin} ${className}`}>
      {children}
    </Link>
  );
}

/**
 * A figure in the stat strip.
 *
 * The figure is mono because it is evidence; the label is sans because it is a
 * sentence about the evidence. `source` is the provenance line — a number
 * without one is the thing this whole company argues against.
 */
export function Stat({
  figure,
  unit,
  label,
  source,
}: {
  figure: string;
  unit?: string;
  label: string;
  source?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-7 sm:px-8">
      <p className="m-0 flex items-baseline gap-1.5">
        <span className="oi-num text-[clamp(1.6rem,1.1rem+1.6vw,2.15rem)] leading-none">
          {figure}
        </span>
        {unit ? <span className="oi-num text-[13px] text-[var(--ink2)]">{unit}</span> : null}
      </p>
      <p className="m-0 text-[13.5px] leading-snug text-[var(--ink2)]">{label}</p>
      {source ? <p className="oi-label m-0 mt-0.5">{source}</p> : null}
    </div>
  );
}

/**
 * A spec row: what the thing is, and the material it is made of.
 *
 * This is the page's whole argument in one component. Adjectives are what
 * every competitor sells on; "18MM BWP" is checkable, and a customer who can
 * read it can tell two quotes apart. The value is mono, always.
 */
export function SpecRow({
  label,
  value,
  better = false,
}: {
  label: string;
  value: string;
  /** Muted sage — marks the better spec in a comparison. Never terracotta. */
  better?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-2.5 last:border-b-0">
      <span className="text-[13.5px] text-[var(--ink2)]">{label}</span>
      <span
        className="oi-num text-[11.5px] uppercase tracking-[0.1em]"
        style={better ? { color: 'var(--sec-ink)' } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

/** A tick in sage. Verification, never terracotta. */
export function Tick({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`flex-none ${className}`}
      style={style}
    >
      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M4.8 8.2 6.9 10.3 11.2 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A flag: a short terracotta bar, then what is missing.
 *
 * This is the page's other argument, and the counterpart to `SpecRow`. Where
 * a spec row says what something *is* — "18MM BWP" — a flag points at what a
 * document does not say: NO NUMBER, WHICH BRAND?, NO REPLY IN 13 DAYS.
 *
 * Terracotta is right here and nowhere decorative: the locked palette gives
 * it to high-intent actions *and* gap flags, and pointing at an omission is
 * precisely a gap flag. Mono, because it is evidence about a document.
 *
 * Kept as one component so the fifteen or so of these across the evidence
 * board cannot drift into fifteen slightly different greys.
 */
export function Flag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <span
        aria-hidden
        className="inline-block h-[1.5px] w-4 flex-none"
        style={{ background: 'var(--acc)' }}
      />
      {/* The bar stays --acc (a mark, exempt from text contrast); the
          words use --acc-ink, which is the same hue dark enough to read
          at 9.5px. See the token block in globals.css. */}
      <span
        className="oi-num text-[9.5px] uppercase tracking-[0.16em]"
        style={{ color: 'var(--acc-ink)' }}
      >
        {children}
      </span>
    </span>
  );
}

export function PlayIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
      <path d="M1 1.2v11.6a.6.6 0 0 0 .92.5l9.2-5.8a.6.6 0 0 0 0-1L1.92.7A.6.6 0 0 0 1 1.2Z" />
    </svg>
  );
}
