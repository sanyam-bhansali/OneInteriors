'use client';

/** Shared form primitives for the onboarding steps. Kept in one file so the
 *  four steps cannot drift into four slightly different-looking forms. */

import { useEffect, useRef, useState } from 'react';
import { FIELD_WIDTH, type FieldWidth } from '@/components/ui/form';
import type { DraftState } from './useAutosave';

export function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required = false,
  error,
  hint,
  placeholder,
  step,
  width = 'full',
  suffix,
  mono = false,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  /**
   * For number inputs. Without it the browser assumes `step=1` and silently
   * refuses a decimal — which made ₹7.5 lakh, an entirely ordinary project
   * floor, impossible to enter.
   */
  step?: string;
  /**
   * How wide the box is, named after the ANSWER rather than the layout — see
   * `FIELD_WIDTH`. Defaults to filling the column, which is right inside a
   * two-up grid and wrong on its own: a team size of 8 does not need forty
   * characters, and giving it forty is most of why these forms looked broken.
   */
  width?: FieldWidth;
  /** A unit beside the box, so it need not bloat the label. */
  suffix?: string;
  mono?: boolean;
}) {
  return (
    <div className={width === 'xs' ? '' : 'w-full'}>
      <label htmlFor={name} className="label m-0 mb-2 block">
        {label}
        {required ? '' : ' — optional'}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={name}
          name={name}
          type={type}
          step={step}
          defaultValue={defaultValue ?? undefined}
          required={required}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          className={`${FIELD_WIDTH[width]} rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-petrol)] ${
            mono ? 'font-[family-name:var(--font-mono)] tracking-[0.02em]' : ''
          } ${type === 'number' ? 'tabular-nums' : ''}`}
        />
        {suffix ? (
          <span className="whitespace-nowrap text-[14px] text-[var(--color-ink-3)]">{suffix}</span>
        ) : null}
      </div>
      <FieldNote name={name} error={error} hint={hint} />
    </div>
  );
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label m-0 mb-2 block">
        {label} — optional
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3 text-[15px] text-[var(--color-ink)]"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldNote name={name} error={error} />
    </div>
  );
}

export function Chips({
  label,
  name,
  options,
  selected = [],
  error,
  hint,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  selected?: string[];
  error?: string;
  hint?: string;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="label m-0 mb-2 p-0">{label}</legend>
      {hint ? (
        <p className="m-0 mb-3 max-w-[52ch] text-[13.5px] leading-snug text-[var(--color-ink-3)]">
          {hint}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-2 text-[14.5px] text-[var(--color-ink-2)] has-[:checked]:border-[var(--color-petrol)] has-[:checked]:bg-[var(--color-petrol-soft)] has-[:checked]:text-[var(--color-ink)]"
          >
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={selected.includes(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      <FieldNote name={name} error={error} />
    </fieldset>
  );
}

export function Check({
  label,
  name,
  hint,
  error,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name={name}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-petrol)]"
        />
        <span>
          <span className="block text-[15px] leading-snug text-[var(--color-ink)]">{label}</span>
          {hint ? (
            <span className="mt-0.5 block text-[13.5px] leading-snug text-[var(--color-ink-3)]">
              {hint}
            </span>
          ) : null}
        </span>
      </label>
      <FieldNote name={name} error={error} />
    </div>
  );
}

export function FieldNote({
  name,
  error,
  hint,
}: {
  name: string;
  error?: string;
  hint?: string;
}) {
  if (error) {
    return (
      <p id={`${name}-error`} role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={`${name}-hint`} className="m-0 mt-1.5 text-[13px] leading-snug text-[var(--color-ink-3)]">
        {hint}
      </p>
    );
  }
  return null;
}

export function SaveBar({
  pending,
  saved,
  formError,
  label = 'Save and continue',
  draft,
  missing,
  formId,
}: {
  pending: boolean;
  saved: boolean;
  formError?: string;
  label?: string;
  /** Present only on steps wired to `useAutosave`. */
  draft?: DraftState;
  /**
   * What is still short, in the studio's words. Omitted entirely on steps
   * that do not compute it — an empty array means "nothing missing", which is
   * a different claim from "not checked", and the button behaves differently
   * for each.
   */
  missing?: string[];
  /**
   * The form this button submits, when it is not inside one.
   *
   * The registration step needs the document upload — a `<form>` of its own,
   * because a file needs its own submit — to sit *between* the fields and the
   * button. HTML has no nested forms, so containment cannot express that
   * layout. `form="id"` can, and it is the reason this prop exists rather
   * than the sections being reordered to suit the markup.
   */
  formId?: string;
}) {
  const blocked = missing !== undefined && missing.length > 0;

  return (
    /**
     * Sticky, so the action is never below the fold on a six-section page.
     *
     * The blur and the top rule are what stop it reading as a floating bar
     * over content: it is the bottom edge of the form, and the card scrolls
     * up behind it.
     */
    /* A solid ground, not a translucent one. `bg-[var(--color-paper)]/85`
       reads as the obvious choice and does not work: Tailwind's opacity
       modifier needs a colour it can parse, and a bare CSS variable is not
       one — the alpha is dropped and the bar renders fully opaque anyway, or
       not at all. Matching the page ground exactly gets the same result with
       nothing to go wrong underneath it. */
    <div className="sticky bottom-0 -mx-1 mt-2 border-t border-[var(--color-rule)] bg-[var(--color-paper)] px-1 py-4">
      {formError ? (
        <p role="alert" className="m-0 mb-3 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-2.5 text-[14.5px] text-[var(--color-atrisk)]">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        form={formId}
        disabled={pending || blocked}
        /**
         * Full width, because on this step it is the only thing to do next.
         *
         * `disabled` and not merely styled: a button that looks dead and
         * submits anyway teaches somebody that the greying means nothing,
         * and then they stop reading it on the step where it matters.
         */
        className="oi-save inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--color-petrol)] px-7 py-3.5 text-[15px] font-medium text-[var(--color-paper)] disabled:cursor-not-allowed disabled:bg-[var(--color-ink-3)] disabled:opacity-60"
      >
        {pending ? 'Saving…' : label}
        {pending || blocked ? null : <span aria-hidden="true">→</span>}
      </button>

      {/* The explanation is not optional decoration — it is the half of the
          disabled state that makes it usable. A padlock with "complete all
          required fields" says the same thing as the grey, which is that
          something is wrong, and nothing at all about what. Naming them
          turns the button into a checklist. */}
      <div className="mt-2.5 flex min-h-[20px] flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
        {blocked ? (
          <p className="m-0 text-[13px] text-[var(--color-ink-2)]">
            Still needed: {missing.join(', ')}.
          </p>
        ) : (
          <>
            <SavedFlash pending={pending} saved={saved} />
            {draft ? <DraftStatus state={draft} /> : null}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * What autosave has and has not done.
 *
 * ## The wording is the point
 *
 * It says **"Draft saved"**, never "Saved" on its own, and never anything
 * with "complete" in it. The draft write does not validate, so all it can
 * honestly promise is that what is in the boxes is also on our server. A
 * studio reading a bare "Saved" beside a half-filled form would reasonably go
 * away believing the step was finished, which is the exact confusion this
 * step has already produced once — see the note on `saveProfile`.
 *
 * ## Why 'typing' shows nothing
 *
 * A "Saving…" that appears on every keystroke is a flicker in the corner of
 * somebody's eye while they are trying to write a paragraph. The quiet state
 * between a keystroke and the save is genuinely nothing worth reporting.
 *
 * ## Why a failure is this quiet
 *
 * Their work is still in front of them, the next pause retries, and the Save
 * button is untouched. An alert would be interrupting somebody mid-sentence
 * to tell them about a problem they cannot act on and that will probably have
 * resolved itself before they finish the line.
 */
function DraftStatus({ state }: { state: DraftState }) {
  if (state === 'clean' || state === 'typing') return null;

  return (
    <span
      role="status"
      aria-live="polite"
      /* Deliberately the quietest ink in the palette, failure included. This
         is a status line, not a claim about the step, and it sits next to a
         button that is the thing to read. */
      className="text-[13.5px] text-[var(--color-ink-3)]"
    >
      {state === 'saving'
        ? 'Saving…'
        : state === 'saved'
          ? 'Draft saved'
          : 'Could not save just now — we will keep trying.'}
    </span>
  );
}

/**
 * "Saved" — briefly, and meaning only that.
 *
 * ## Why it goes away
 *
 * It used to be a permanent green "Saved." beside the button. Permanent is
 * the wrong shape for this: it is still sitting there two minutes later while
 * the studio edits three more fields, so by the time it matters it is stale,
 * and a studio that has typed something and not pressed Save is looking at a
 * word that says they have. A flash is a receipt for an event, which is what
 * a save is.
 *
 * ## Why it does not say "complete"
 *
 * This is the distinction this file has been bitten by. `saveProfile` once
 * accepted a blank required field and returned a green "Saved." — true, and
 * read as "this step is finished", so a studio went away and came back to
 * find the step still unticked. The write landing and the step passing are
 * two claims, and only one of them is being made here. The other is the
 * badge in the page header and the list in the footer, both of which are
 * re-derived on the server after every save.
 *
 * ## Why it keys on the pending edge
 *
 * `saved` stays true across consecutive saves, so an animation watching it
 * fires once and never again — the second save would be silent, which is
 * worse than no feedback, because the studio has now been taught the flash
 * means something. Watching pending fall from true gives one flash per
 * submission.
 */
function SavedFlash({ pending, saved }: { pending: boolean; saved: boolean }) {
  const [visible, setVisible] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    const justFinished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!justFinished || !saved) return;

    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(timer);
  }, [pending, saved]);

  return (
    /* `status`, not `alert`: a successful save is not an interruption, and a
       screen reader should finish the sentence it is on before announcing it.
       The node is always mounted so the live region exists before it has
       anything to say — one appearing with content already in it is a region
       many readers will not announce. */
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 text-[14px] text-[var(--color-ontrack)] transition-opacity duration-500 motion-reduce:transition-none ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {visible ? (
        <>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
            <path
              d="M3.5 8.5 L6.5 11.5 L12.5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Saved
        </>
      ) : null}
    </span>
  );
}
