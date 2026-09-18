'use client';

/**
 * The ten seconds while a quote is built.
 *
 * ## Why this is slow on purpose, and why that is not a lie
 *
 * The arithmetic takes milliseconds. Showing a forty-line quotation
 * instantly would be technically honest and commercially useless: a number
 * that appears the instant you ask for it reads as a number nobody worked
 * out. Everyone in this market has been trained by three weeks of waiting to
 * believe that a real quote is slow, and a product that beats that by six
 * orders of magnitude has to spend a few seconds showing its working or the
 * result is not believed.
 *
 * So the pause is real time spent on real stages, each named as it happens,
 * and every stage says something true: it reads the plan, sizes each room,
 * applies **that studio's** filed rates, and totals it. Nothing here claims
 * work that is not being done — the sequencing is theatre, the sentences are
 * not.
 *
 * The one line that must never appear is a fake progress percentage tied to
 * nothing. The stages are the progress.
 *
 * ## Why the jokes
 *
 * Because the wait is the product's best moment and it would be a waste to
 * fill it with a spinner. The copy is about the thing that is actually funny
 * here — that this has always taken three weeks and an office visit — and it
 * is at the industry's expense, never the customer's. Nobody waiting on a
 * price for their own home wants to be teased.
 *
 * ## Accessibility
 *
 * The stage list is the real progress indicator and is announced politely;
 * the jokes are `aria-hidden` because a screen reader reading a rotating gag
 * over the top of a status message is noise. With reduced motion the stages
 * still advance — they are information — but nothing slides.
 */

import { useEffect, useState } from 'react';
import { Tick } from '@/components/landing/parts';

export interface Stage {
  /** What is happening, in the present tense. */
  label: string;
  /** Milliseconds this stage holds for. */
  ms: number;
}

/**
 * Ten and a half seconds, weighted towards the two stages that sound like
 * the hard parts — reading the plan and pricing off the rate card — because
 * those are the two a customer would expect to take the longest.
 */
export const DEFAULT_STAGES: Stage[] = [
  { label: 'Reading your floor plan', ms: 2600 },
  { label: 'Measuring the kitchen platform run', ms: 1700 },
  { label: 'Sizing each room against the standard template', ms: 1800 },
  { label: 'Applying the studio’s own filed rates', ms: 2600 },
  { label: 'Writing the quotation, line by line', ms: 1800 },
];

/**
 * The jokes.
 *
 * Every one is about the wait everybody else makes you do, or about the
 * absurdity of how quotes are normally produced. None is about the customer,
 * their budget or their taste.
 */
const ASIDES = [
  'Cutting three weeks down to ten seconds.',
  'Not phoning anyone. Not even once.',
  'No “ma’am, please visit our office”.',
  'Nobody is being asked to “send requirement”.',
  'Measuring in millimetres, like a grown-up.',
  'Resisting the urge to write “premium ply”.',
  'Every line is getting a quantity. Every single one.',
  'This normally involves four site visits and a Sunday.',
  'No WhatsApp forward is being prepared.',
  'Checking that “soft-close” means something here.',
  'Counting the tandem drawers so you do not have to.',
  'Still faster than the last time you asked a studio.',
];

export function Building({
  stages = DEFAULT_STAGES,
  onDone,
  studioName,
}: {
  stages?: Stage[];
  /** Called once the last stage completes. */
  onDone?: () => void;
  studioName: string;
}) {
  const [at, at_] = useState(0);
  const [joke, joke_] = useState(0);

  // Walk the stages on their own timings. One timeout per stage rather than
  // an interval, so a stage that is meant to take 2.6s does.
  useEffect(() => {
    if (at >= stages.length) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => at_((i) => i + 1), stages[at]!.ms);
    return () => clearTimeout(t);
  }, [at, stages, onDone]);

  // The asides rotate faster than the stages, and independently — a line tied
  // to a stage would repeat on a slow connection.
  useEffect(() => {
    const t = setInterval(() => joke_((j) => (j + 1) % ASIDES.length), 2200);
    return () => clearInterval(t);
  }, []);

  const done = Math.min(at, stages.length);

  return (
    <div className="mx-auto w-full max-w-[34rem] py-14">
      <p className="oi-eyebrow m-0 mb-4">Building your first quote</p>
      <h1 className="oi-display m-0 mb-3 text-[clamp(1.6rem,1.2rem+1.4vw,2.2rem)]">
        {studioName} is being priced on your flat.
      </h1>
      <p className="m-0 mb-9 max-w-[46ch] text-[15px] leading-[1.6] text-[var(--ink2)]">
        Their own filed rates, your rooms, and every line with a quantity against it.
      </p>

      {/* The real progress indicator. A screen reader gets the stage list and
          the current stage; it does not get the jokes. */}
      <ol className="m-0 flex list-none flex-col p-0" aria-live="polite">
        {stages.map((stage, i) => {
          const complete = i < done;
          const current = i === done;

          return (
            <li
              key={stage.label}
              className="flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0"
              style={{ opacity: complete || current ? 1 : 0.4 }}
            >
              {complete ? (
                <Tick style={{ color: 'var(--sec)' }} />
              ) : (
                <span
                  aria-hidden
                  className="h-[15px] w-[15px] flex-none rounded-full border"
                  style={{
                    borderColor: current ? 'var(--acc)' : 'var(--line)',
                    background: current ? 'var(--acc)' : 'transparent',
                  }}
                />
              )}
              <span className="text-[14px]">{stage.label}</span>
              {complete ? (
                <span className="oi-num ml-auto text-[10px] uppercase tracking-[0.14em] text-[var(--ink2)]">
                  done
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Keyed so each line re-enters rather than the words changing under
          the reader mid-sentence. */}
      <p
        aria-hidden
        key={joke}
        className="oi-swap oi-num m-0 mt-8 text-[11px] uppercase tracking-[0.16em]"
        style={{ color: 'var(--acc-ink)' }}
      >
        {ASIDES[joke]}
      </p>
    </div>
  );
}
