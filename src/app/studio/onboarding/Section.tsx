'use client';

import { Check } from 'lucide-react';
import { DISC_ICON } from './icon-sizes';


/**
 * One numbered block of a guided setup.
 *
 * ## Why numbers, and why cards
 *
 * A stack of labelled inputs is a form; a numbered sequence of cards is a
 * thing somebody is being walked through. The difference is entirely
 * psychological and entirely real: the number says how much is left, and the
 * card edge says where one question stops and the next begins.
 *
 * The number is `aria-hidden`. A screen reader already announces "group,
 * Studio description" from the fieldset and its legend; reading "one" before
 * it adds nothing and turns six headings into twelve.
 *
 * ## `done` is a signal, not a reward
 *
 * The tick appears when a section holds enough to submit, which is also
 * exactly when the CTA stops being disabled. That correspondence is the
 * point — somebody looking at a greyed-out button needs to be able to find
 * the untick without reading anything.
 */
export function Section({
  n,
  title,
  hint,
  done,
  optional,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  /** Undefined for a section nothing depends on, so it shows no state at all. */
  done?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="oi-sec m-0 rounded-[16px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-0">
      <div className="flex items-start gap-3 px-5 pt-5 sm:px-6 sm:pt-5">
        <span
          aria-hidden="true"
          className={`oi-sec-n mt-px grid h-[26px] w-[26px] flex-none place-items-center rounded-full text-[13px] font-semibold ${
            done
              ? 'bg-[var(--color-ontrack)] text-white'
              : 'bg-[var(--color-paper-3)] text-[var(--color-ink-2)]'
          }`}
        >
          {done ? <Check {...DISC_ICON} /> : n}
        </span>

        <div className="min-w-0 flex-1">
          <legend className="m-0 flex flex-wrap items-baseline gap-x-2 p-0 text-[15.5px] font-semibold text-[var(--color-ink)]">
            {title}
            {optional ? (
              <span className="text-[13px] font-normal text-[var(--color-ink-3)]">Optional</span>
            ) : null}
          </legend>
          {hint ? (
            <p className="m-0 mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
              {hint}
            </p>
          ) : null}
        </div>
      </div>

      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">{children}</div>
    </fieldset>
  );
}


/**
 * How long the description is, against the length that actually matters.
 *
 * The mockup for this screen counted up to 500. The real rule is a MINIMUM of
 * eighty — `MIN_ABOUT_LENGTH`, enforced by `saveProfile` — and a ceiling of
 * 1,200. Those are opposite kinds of number and only one of them can stop
 * somebody submitting, so the counter leads with the floor and mentions the
 * ceiling only once it is close.
 *
 * A counter that disagrees with the server is worse than none: it either
 * blocks somebody for a rule nobody enforces, or says they are fine and then
 * the save fails.
 */
export function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const short = value < min;
  const near = value > max - 150;

  return (
    <p
      className={`m-0 text-[12.5px] tabular-nums ${
        short
          ? 'text-[var(--color-ink-3)]'
          : near
            ? 'text-[var(--color-brass)]'
            : 'text-[var(--color-ontrack)]'
      }`}
    >
      {short ? (
        <>
          {/* Counting DOWN to the threshold, not up from zero. "44 more" is an
              instruction; "36 / 80" is arithmetic somebody has to do. */}
          {min - value} more {min - value === 1 ? 'character' : 'characters'} needed
        </>
      ) : near ? (
        <>{max - value} characters left</>
      ) : (
        <>Long enough</>
      )}
    </p>
  );
}
