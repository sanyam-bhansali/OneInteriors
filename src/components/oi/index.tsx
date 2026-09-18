/**
 * The customer software, in the landing page's language.
 *
 * ## The idea these primitives exist to serve
 *
 * The landing page argues one thing: **evidence beats adjectives.** Every
 * claim on it carries a quantity, a material or a named verifier, and the
 * reader is invited to check rather than believe.
 *
 * The software behind it used to be a wizard — steps, a progress bar, a
 * summary at the end. That is a different argument, and a customer who has
 * just read the landing page feels the change of subject even if they cannot
 * name it.
 *
 * So the screens after the landing page are built as **one document the
 * customer is assembling about their own flat**, thickening as they go: the
 * brief, who fits it, what it costs, the two quotes side by side, and the
 * architect reading it with them. `Sheet` is a page of that document.
 * `DocRow` is a line in it. `Figure` is a number in it, and it will not let
 * you state one without saying where it came from.
 *
 * ## The rules, restated so they survive
 *
 * - Squared corners everywhere EXCEPT glass and what sits inside it.
 * - Mono is evidence: money, quantities, specs, scores, counters, labels.
 *   Sans is sentences. Serif is headings and product names. Never mono for
 *   body copy.
 * - Terracotta (`--acc`) is the ONE high-intent action per screen, and gap
 *   flags. Never a rule, never a hover, never decoration.
 * - Sage (`--sec`) is verification and better-spec. Never an action.
 * - `--acc-ink` / `--sec-ink` are the same hues when the accent is the *ink*;
 *   the pure tokens fail WCAG AA at label sizes. See globals.css.
 *
 * Colours come from the `.oi-app` token block and never from a literal hex.
 */

import Link from 'next/link';

// Re-exported so a screen imports one module. These are surface-agnostic and
// already correct; duplicating them here is how two Ticks end up different.
export { Wrap, Eyebrow, Heading, Cta, Tick, Flag, SpecRow, PlayIcon } from '@/components/landing/parts';

/**
 * The root of any customer screen.
 *
 * Carries `.oi-app`, which is where the palette lives, and nothing else —
 * layout belongs to the screen. `min-h-dvh` so a short page still paints the
 * Raw Silk ground to the bottom rather than leaving the body's cream showing
 * under it, which is the one way these two palettes can be seen touching.
 */
export function Page({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`oi-app min-h-dvh bg-[var(--bg)] ${className}`}>{children}</div>
  );
}

/**
 * A page of the document.
 *
 * Alabaster on the Raw Silk ground, one hairline, square. This is the single
 * most-used surface in the product and it is deliberately plain: it is paper,
 * and the interest on it should come from what is written, not from the card.
 *
 * `lifted` adds the shadow the landing page uses on its exhibit cards. Use it
 * when a sheet sits *over* something — a quote on a photograph, a dialog —
 * and not otherwise, because a page of a document does not float.
 */
export function Sheet({
  children,
  className = '',
  lifted = false,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  lifted?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Tag
      className={`border border-[var(--line)] bg-[var(--card)] ${className}`}
      style={lifted ? { boxShadow: '0 26px 50px -34px rgba(44,38,36,.45)' } : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * The header of a chapter: mono eyebrow → serif heading → sans body.
 *
 * The locked section language, as one component, so a screen cannot
 * accidentally invent a fourth arrangement. `aside` is the right-hand slot for
 * the mono stamp the landing page uses ("ONE FAILED CHECK, NOT LISTED") —
 * useful for the caveat that would otherwise become a sentence nobody reads.
 */
export function Chapter({
  eyebrow,
  title,
  children,
  aside,
  className = '',
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-5 ${className}`}>
      <div className="min-w-0">
        <p className="oi-eyebrow m-0 mb-4">{eyebrow}</p>
        <h1 className="oi-display m-0 max-w-[24ch] text-[clamp(1.75rem,1.1rem+2.1vw,2.6rem)]">
          {title}
        </h1>
        {children ? (
          <div className="m-0 mt-5 max-w-[58ch] text-[15px] leading-[1.65] text-[var(--ink2)]">
            {children}
          </div>
        ) : null}
      </div>
      {aside ? <div className="text-left sm:text-right">{aside}</div> : null}
    </header>
  );
}

/**
 * One line of the document: what it is, and what it is.
 *
 * The counterpart to `SpecRow` on the landing page, widened for the software —
 * a quotation line needs a quantity AND an amount AND sometimes a note, and
 * squeezing that into label/value produced three different ad-hoc rows across
 * three screens before this existed.
 *
 * `quantity` is the load-bearing one. A line without a quantity is exactly
 * what the Problem section on the landing page holds up as the thing wrong
 * with everybody else's quote, so it renders in its own column rather than
 * being folded into the label where it can be dropped.
 */
export function DocRow({
  label,
  quantity,
  value,
  note,
  better = false,
  emphasis = false,
}: {
  label: string;
  /** "84 SQ FT · 18MM BWP". Mono, and the point of the row. */
  quantity?: string;
  /** Money or a spec. Mono, always. */
  value?: string;
  /** A sentence under the line, when the row needs explaining. */
  note?: string;
  /** Sage — marks the better spec in a comparison. Never terracotta. */
  better?: boolean;
  /** The total line: heavier rule above, larger value. */
  emphasis?: boolean;
}) {
  return (
    <div
      className={`py-2.5 ${
        emphasis
          ? 'border-t border-[var(--ink)] pt-3'
          : 'border-b border-[var(--line)] last:border-b-0'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span
          className={emphasis ? 'oi-label m-0' : 'text-[13.5px] text-[var(--ink2)]'}
        >
          {label}
        </span>
        {value ? (
          <span
            className={`oi-num ${emphasis ? 'text-[17px]' : 'text-[12.5px]'}`}
            style={better ? { color: 'var(--sec-ink)' } : undefined}
          >
            {value}
          </span>
        ) : null}
      </div>

      {quantity ? (
        <p className="oi-num m-0 mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--ink2)]">
          {quantity}
        </p>
      ) : null}

      {note ? (
        <p className="m-0 mt-1.5 text-[12.5px] leading-snug text-[var(--ink2)]">{note}</p>
      ) : null}
    </div>
  );
}

/**
 * A number, and where it came from.
 *
 * `source` is required and not optional, on purpose. The whole product is an
 * argument against figures nobody can check, and the cheapest way for this
 * codebase to start producing them is a `Figure` component with an optional
 * provenance line that everybody leaves off. If a number genuinely has no
 * source, say so in the slot — "your answers", "Teakline's filed rate card",
 * "not enough data yet" — because that sentence is itself the honest answer.
 */
export function Figure({
  value,
  unit,
  label,
  source,
  tone = 'ink',
}: {
  value: string;
  unit?: string;
  label: string;
  source: string;
  /** `sec` for a verified count, `acc` for something needing attention. */
  tone?: 'ink' | 'sec' | 'acc';
}) {
  const colour =
    tone === 'sec' ? 'var(--sec-ink)' : tone === 'acc' ? 'var(--acc-ink)' : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="m-0 flex items-baseline gap-1.5">
        <span
          className="oi-num text-[clamp(1.6rem,1.1rem+1.6vw,2.15rem)] leading-none"
          style={colour ? { color: colour } : undefined}
        >
          {value}
        </span>
        {unit ? <span className="oi-num text-[13px] text-[var(--ink2)]">{unit}</span> : null}
      </p>
      <p className="m-0 text-[13.5px] leading-snug text-[var(--ink2)]">{label}</p>
      <p className="oi-label m-0 mt-0.5">{source}</p>
    </div>
  );
}

/**
 * The frosted frame, for things that are live rather than recorded.
 *
 * The one curved surface in the system, and the only place 999px pills are
 * allowed. Reserve it for state that is *happening* — the architect's panel,
 * a quote being priced, a match still narrowing. A settled fact belongs on a
 * `Sheet`; putting it on glass says it might still change.
 */
export function Glass({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 26,
        border: '1px solid rgba(252,252,250,.22)',
        background: 'rgba(36,29,26,.5)',
        backdropFilter: 'blur(22px) saturate(1.15)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.15)',
        boxShadow: '0 40px 80px -40px rgba(0,0,0,.6), inset 0 1px 0 rgba(252,252,250,.16)',
      }}
    >
      {children}
    </div>
  );
}

/**
 * A quiet link that is not the screen's action.
 *
 * Exists so screens stop reaching for `Cta intent="quiet"` for what is really
 * navigation. One terracotta action per screen; everything else is this.
 */
export function Quiet({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 text-[13.5px] font-medium text-[var(--ink)] no-underline transition-colors hover:border-[var(--ink2)] ${className}`}
    >
      {children}
    </Link>
  );
}

/**
 * What is true so far — the running state of the document.
 *
 * Shown at the top of the later chapters. It is not a breadcrumb and not a
 * progress bar: it lists facts the customer has established, in their own
 * terms, so arriving on the quote screen begins with "2 BHK · Baner ·
 * ₹14.4–25.6 L" rather than "Step 3 of 5".
 */
export function Established({ facts }: { facts: { label: string; value: string }[] }) {
  if (facts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-[var(--line)] py-3">
      {facts.map((f) => (
        <p key={f.label} className="m-0 flex items-baseline gap-2">
          <span className="oi-label m-0">{f.label}</span>
          <span className="oi-num text-[12.5px]">{f.value}</span>
        </p>
      ))}
    </div>
  );
}
