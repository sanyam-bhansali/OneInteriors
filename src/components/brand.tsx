/**
 * Brand assets.
 *
 * The mark is a door swing — the drafting convention for an opening: two wall
 * stubs, a quarter-circle arc, and the leaf. Chosen because it is the one
 * symbol that reads as "plan" and "home" simultaneously to anyone who has ever
 * looked at a floor plan, it survives down to a 16px favicon, and nobody else
 * in Indian interiors is using it — the category is wall-to-wall house
 * outlines and sofa glyphs.
 *
 * It also means the right thing: a door opening. Which is the product.
 */

export function Mark({ className = '', title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role={title ? 'img' : 'presentation'} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}

      {/* Wall stubs — poché, drawn as solid mass the way a plan does it */}
      <rect x="2" y="24.5" width="7.5" height="3.5" fill="currentColor" />
      <rect x="24.5" y="2" width="3.5" height="7.5" fill="currentColor" />

      {/* Swing arc */}
      <path
        d="M9.5 26.25 A16.75 16.75 0 0 1 26.25 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.45"
      />

      {/* The leaf */}
      <path
        d="M9.5 26.25 L26.25 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Lockup. The city sits as a locality tag rather than a tagline — this is a
 * one-city product and saying so is a trust signal, not a limitation.
 */
export function Wordmark({
  className = '',
  showCity = true,
}: {
  className?: string;
  showCity?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark className="h-[26px] w-[26px] shrink-0 text-[var(--color-petrol)]" />
      <span className="flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-display)] text-[21px] leading-none tracking-[-0.01em] text-[var(--color-ink)]">
          One Interiors
        </span>
        {showCity ? (
          <span className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            Pune
          </span>
        ) : null}
      </span>
    </span>
  );
}
