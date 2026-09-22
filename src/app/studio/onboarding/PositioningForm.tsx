'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { savePositioningAction, type StepState } from './actions';
import { Section } from './Section';
import { SaveBar } from './fields';
import {
  OFFERINGS,
  OFFERING_COPY,
  PRICE_LEVELS,
  PRICE_LEVEL_COPY,
  suggestedLevel,
  type Offering,
  type PriceLevel,
} from '@/modules/studio/positioning';

const INITIAL: StepState = { status: 'idle' };

/**
 * How the studio wants to be read, as opposed to what it charges.
 *
 * ## Why this is a separate form from the rate card on the same step
 *
 * They answer different questions and they fail differently. The rate card is
 * arithmetic the quoting engine runs — six numbers, all required, and without
 * them a studio produces no quote and drops out of the comparison entirely.
 * This is two choices that describe a practice and block nothing.
 *
 * Saving them together would mean a studio who picks "turnkey" and has not
 * settled on a wardrobe rate gets neither stored. Two forms, two buttons, and
 * the step still completes on the rates, because that is the half without
 * which the product does not work.
 *
 * ## The budget range is shown here and edited on step one
 *
 * The mockup put min and max on this page. They are already collected on the
 * profile step, where they belong — they are a filter on which briefs a
 * studio is shown, not a pricing decision — and asking twice would produce
 * two fields that can disagree, with nothing saying which one the matcher
 * reads. So this shows the figures with a link back, which is the honest
 * shape of "you already told us this".
 */
export function PositioningForm({
  offering,
  priceLevel,
  minLakhs,
  maxLakhs,
}: {
  offering: string | null;
  priceLevel: string | null;
  minLakhs: number | null;
  maxLakhs: number | null;
}) {
  const [state, action, pending] = useActionState(savePositioningAction, INITIAL);
  const [chosenOffering, setOffering] = useState<string>(offering ?? '');
  const [chosenLevel, setLevel] = useState<string>(priceLevel ?? '');

  const suggestion = suggestedLevel(minLakhs, maxLakhs);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Section
        n={1}
        title="What do you offer?"
        hint="The one field here the matcher acts on — a design-only practice should never be quoted for execution, and until you tell us we have no way to know."
        done={chosenOffering !== ''}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OFFERINGS.map((value) => (
            <Card
              key={value}
              name="offering"
              value={value}
              checked={chosenOffering === value}
              onSelect={() => setOffering(value)}
              title={OFFERING_COPY[value as Offering].label}
              detail={OFFERING_COPY[value as Offering].detail}
            />
          ))}
        </div>
      </Section>

      <Section
        n={2}
        title="The size of project you take"
        hint="You gave us this on the first step. It is the filter that decides which briefs reach you at all."
      >
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[12px] bg-[var(--color-paper-2)] px-5 py-4">
          <p className="m-0 font-[family-name:var(--font-mono)] text-[17px] tabular-nums text-[var(--color-ink)]">
            {minLakhs !== null && maxLakhs !== null ? (
              <>
                ₹{minLakhs}L <span className="text-[var(--color-ink-3)]">—</span> ₹{maxLakhs}L
              </>
            ) : (
              <span className="text-[15px] text-[var(--color-ink-3)]">Not set yet</span>
            )}
          </p>
          {/* `Link`, not an anchor. A bare `<a>` here is a full document
              reload, which on a step that holds two unsaved radio choices
              throws them away — the studio comes back and finds their
              positioning reset. */}
          <Link
            href="/studio/onboarding/profile"
            className="text-[13.5px] text-[var(--color-petrol)] underline underline-offset-4"
          >
            Change it on Your studio
          </Link>
        </div>

        {/* The guidance the brief asked for, stated as a pattern we have
            observed rather than as advice. A marketplace telling a studio to
            raise its floor has an interest in that number, and saying so
            plainly is the difference between guidance and a nudge. */}
        <Insight>
          A higher floor usually means fewer briefs and better ones. Studios with a floor under
          ₹5L spend most of their time on enquiries that do not convert — but this is your call,
          and we do not move the number.
        </Insight>
      </Section>

      <Section
        n={3}
        title="Where you sit in the market"
        hint="How you want to be read. Shown to customers; never used to rank you."
        done={chosenLevel !== ''}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRICE_LEVELS.map((value) => (
            <Card
              key={value}
              name="priceLevel"
              value={value}
              checked={chosenLevel === value}
              onSelect={() => setLevel(value)}
              title={PRICE_LEVEL_COPY[value as PriceLevel].label}
              detail={PRICE_LEVEL_COPY[value as PriceLevel].range}
              compact
            />
          ))}
        </div>

        {/* A suggestion, never a default. The field starts empty even when we
            can guess, because turning a number given for one purpose into a
            claim the studio never made is precisely the thing this codebase
            keeps having to undo. */}
        {suggestion && chosenLevel === '' ? (
          <p className="m-0 mt-3 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
            Your range usually reads as{' '}
            <strong className="text-[var(--color-ink)]">
              {PRICE_LEVEL_COPY[suggestion].label}
            </strong>
            . Pick whatever is actually true — we have not chosen for you.
          </p>
        ) : null}
      </Section>

      <SaveBar
        pending={pending}
        saved={state.status === 'saved'}
        formError={state.errors?.form}
        label="Save how you are described"
      />
    </form>
  );
}

/**
 * A selectable card that is really a radio.
 *
 * The input is visually hidden rather than absent, so the choice posts with
 * the form whether or not this component's state ever ran, arrow keys move
 * between options the way a radio group should, and the keyboard focus ring
 * has something to attach to.
 */
function Card({
  name,
  value,
  checked,
  onSelect,
  title,
  detail,
  compact,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <label
      className={`oi-pick relative flex cursor-pointer flex-col rounded-[13px] border px-4 ${
        compact ? 'py-3.5' : 'py-4'
      } ${
        checked
          ? 'border-[var(--color-petrol)] bg-[var(--color-petrol-soft)]'
          : 'border-[var(--color-rule)] bg-[var(--color-paper-2)]'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />

      <span
        aria-hidden="true"
        className={`absolute right-3 top-3 grid h-[18px] w-[18px] place-items-center rounded-full border ${
          checked
            ? 'border-[var(--color-petrol)] bg-[var(--color-petrol)] text-white'
            : 'border-[var(--color-rule)]'
        }`}
      >
        {checked ? (
          <svg viewBox="0 0 16 16" className="h-2.5 w-2.5">
            <path
              d="M3.5 8.5 L6.5 11.5 L12.5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>

      <span className="pr-6 text-[14.5px] font-medium text-[var(--color-ink)] peer-focus-visible:underline peer-focus-visible:underline-offset-4">
        {title}
      </span>
      <span className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--color-ink-2)]">
        {detail}
      </span>
    </label>
  );
}

function Insight({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-[11px] bg-[var(--color-ontrack-soft)] px-4 py-3">
      <span aria-hidden="true" className="mt-px flex-none text-[var(--color-ontrack)]">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 7.4v4" strokeLinecap="round" />
          <circle cx="8" cy="5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <p className="m-0 max-w-[58ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
        {children}
      </p>
    </div>
  );
}
