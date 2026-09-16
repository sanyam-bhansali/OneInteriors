'use client';

/**
 * Form layout, shared by every form on the site.
 *
 * ## The rule
 *
 * **Space is used by adding a column, never by stretching one.**
 *
 * Every form here began as a single stack of full-width controls inside a
 * 672px container. On a desktop screen that is a narrow strip of boxes adrift
 * in an empty window — and, at the same time, a "team size" input wide enough
 * for a paragraph. Those look like opposite problems and are the same one:
 * sizing by the container instead of by the content.
 *
 * So there are two pieces here and nothing else. `FormSection` puts the
 * question on the left and the answers on the right, which is what actually
 * consumes the width. `FIELD_WIDTH` sizes each control to the answer it takes.
 *
 * Widths are named after the ANSWER, not the layout, so the right one is
 * obvious at the call site and stays right when the layout changes again.
 */

import { useId } from 'react';

export const FIELD_WIDTH = {
  /** A number you can count on one hand's worth of digits. 7, 8, 22. */
  xs: 'w-[7.5rem]',
  /** A reference code. GSTIN, a PIN, a rate. */
  sm: 'w-full max-w-[22rem]',
  /** A name, a phone number, an email. */
  md: 'w-full max-w-[28rem]',
  /** A long name, an address, a URL. */
  lg: 'w-full max-w-[36rem]',
  /** Fills its column. Correct inside a `FieldRow`, wrong on its own. */
  full: 'w-full',
} as const;

export type FieldWidth = keyof typeof FIELD_WIDTH;

/**
 * One block of a form: what we are asking for on the left, the boxes on the
 * right.
 *
 * `<section aria-labelledby>` rather than `<fieldset><legend>`. A `legend` has
 * to be the fieldset's first child to name it, which fights any two-column
 * layout — and a fieldset whose legend is visually somewhere else is worse for
 * a screen reader than a properly labelled section.
 *
 * The left rail sticks on tall screens so you can still see which question you
 * are answering halfway down a long block.
 */
export function FormSection({
  title,
  hint,
  children,
  /** Set on the first section so it does not open with a rule against nothing. */
  first = false,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  first?: boolean;
}) {
  const id = useId();

  return (
    <section
      aria-labelledby={id}
      className={`grid gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] ${
        first ? 'pb-10' : 'border-t border-[var(--color-rule)] py-10'
      }`}
    >
      <div className="lg:sticky lg:top-8 lg:self-start">
        <h2 id={id} className="m-0 font-[family-name:var(--font-display)] text-[26px] leading-tight">
          {title}
        </h2>
        {hint ? (
          <div className="m-0 mt-2 max-w-[38ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
            {hint}
          </div>
        ) : null}
      </div>

      {/* Capped independently of the container. The right column is where the
          controls live, and controls stop being usable long before they stop
          fitting — 44rem is about as wide as a text input should ever be. */}
      <div className="flex max-w-[44rem] flex-col gap-5">{children}</div>
    </section>
  );
}

/** Fields side by side, stacking below `sm`. Two by default. */
export function FieldRow({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <div className={`grid grid-cols-1 gap-5 ${cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {children}
    </div>
  );
}

/**
 * Short fields on one line, each sized to its own answer.
 *
 * Distinct from `FieldRow`, which divides the column evenly. This is for the
 * row of numbers — years active, team size, the two project figures — that a
 * two-column grid would still render four inches wide apiece.
 */
export function FieldCluster({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-x-5 gap-y-5">{children}</div>;
}

/**
 * The submit row, aligned to the answers column rather than the page.
 *
 * A button under the left rail reads as belonging to the last question instead
 * of to the form.
 */
export function FormFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-x-12 gap-y-5 border-t border-[var(--color-rule)] pt-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <div aria-hidden="true" />
      <div className="max-w-[44rem]">{children}</div>
    </div>
  );
}
