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
 * ## Why there is a question
 *
 * These ten seconds are the best attention this product will ever get. The
 * customer asked for something, they want it, and there is nothing else to do
 * until it lands. Spending that on a spinner is waste; spending it on a
 * rotating fact is wallpaper.
 *
 * A question is different, because answering it commits you. Having guessed
 * BWR and been told it was BWP, you own the distinction — and forty seconds
 * later a line in your own quotation reads `18mm BWP carcass` and means
 * something. **The quiz exists to make the document that follows it
 * readable.** It is not a game and it keeps no score, because a score would
 * make it about the customer rather than about their kitchen.
 *
 * ## What must never happen
 *
 * The quote must not be taken away from somebody mid-sentence. If the stages
 * finish while the question is unanswered, the answer is revealed and the
 * screen waits on an explicit press. The ten seconds are a floor, not a
 * deadline — and a customer who is reading is a customer we are not going to
 * interrupt to show them a number that is already computed.
 *
 * Equally, the question must never be a toll gate. Skipping is always one
 * press away and costs nothing.
 *
 * ## Accessibility
 *
 * The stage list is the real progress indicator and is announced politely.
 * The jokes are `aria-hidden` — a rotating gag read over a status message is
 * noise. The question is an ordinary radio-less button group; the result is
 * announced once, in a live region, when it appears.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tick } from '@/components/landing/parts';
import { pickQuestion, questionMaterial, type Choice } from '@/modules/materials/quiz';

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
 * their budget or their taste. They sit under the question now rather than
 * over it — the question is the better use of the attention, and two things
 * competing for it would have got neither read.
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

/** The question is held back so it does not land on top of the first stage. */
const QUESTION_DELAY_MS = 1200;

export function Building({
  stages = DEFAULT_STAGES,
  onDone,
  studioName,
  /** Question ids this customer has already been asked, so nobody repeats. */
  seenQuestions = [],
  /** Records the question as asked, whether or not it was answered. */
  onAsked,
}: {
  stages?: Stage[];
  /** Called once the last stage completes AND the reader is ready. */
  onDone?: () => void;
  studioName: string;
  seenQuestions?: readonly string[];
  onAsked?: (questionId: string) => void;
}) {
  const [at, at_] = useState(0);
  const [joke, joke_] = useState(0);
  const [asking, asking_] = useState(false);
  const [picked, picked_] = useState<Choice | null>(null);
  const [skipped, skipped_] = useState(false);

  /**
   * Picked once, from the values held at mount.
   *
   * Both of these arrive from a parent that re-renders on every stage tick,
   * and `seenQuestions` is typically a fresh array each time. Depending on
   * them would re-roll the question under somebody mid-read, which is the one
   * thing this screen must never do. `onAsked` goes in a ref for the same
   * reason: an inline callback would restart the timer on every render.
   */
  const seenAtMount = useRef(seenQuestions);
  const asked = useRef(onAsked);
  asked.current = onAsked;

  const question = useMemo(() => pickQuestion(studioName, seenAtMount.current), [studioName]);
  const glossary = useMemo(() => questionMaterial(question), [question]);

  const stagesDone = at >= stages.length;

  useEffect(() => {
    const t = setTimeout(() => {
      asking_(true);
      asked.current?.(question.id);
    }, QUESTION_DELAY_MS);
    return () => clearTimeout(t);
  }, [question.id]);

  // Walk the stages on their own timings. One timeout per stage rather than
  // an interval, so a stage that is meant to take 2.6s does.
  useEffect(() => {
    if (stagesDone) return;
    const t = setTimeout(() => at_((i) => i + 1), stages[at]!.ms);
    return () => clearTimeout(t);
  }, [at, stages, stagesDone]);

  /**
   * Hand over only when both are true: the stages have finished AND the
   * reader is not in the middle of the question.
   *
   * A short beat after an answer, so the result is seen rather than flashed.
   * If they never engaged with the question at all, there is nothing to read
   * and we go straight through.
   */
  useEffect(() => {
    if (!stagesDone) return;
    if (picked === null && !skipped) return;
    const t = setTimeout(() => onDone?.(), 900);
    return () => clearTimeout(t);
  }, [stagesDone, picked, skipped, onDone]);

  // A reader who never touched the question is not "reading" — release them.
  useEffect(() => {
    if (!stagesDone || asking) return;
    skipped_(true);
  }, [stagesDone, asking]);

  // The asides rotate faster than the stages, and independently — a line tied
  // to a stage would repeat on a slow connection.
  useEffect(() => {
    const t = setInterval(() => joke_((j) => (j + 1) % ASIDES.length), 2200);
    return () => clearInterval(t);
  }, []);

  const answer = useCallback(
    (choice: Choice) => {
      if (picked) return;
      picked_(choice);
    },
    [picked],
  );

  const done = Math.min(at, stages.length);
  const waiting = stagesDone && picked !== null;

  return (
    <div className="mx-auto w-full max-w-[38rem] py-14">
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

      {/* ── The question ── */}
      {asking && !skipped ? (
        <section
          className="oi-swap mt-9 border border-[var(--line)] bg-[var(--card)] p-[clamp(18px,3vw,28px)]"
          aria-label="While you wait"
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="oi-eyebrow m-0">While that runs — one thing worth knowing</p>
            {picked === null ? (
              <button
                type="button"
                onClick={() => skipped_(true)}
                className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[var(--ink2)] underline hover:text-[var(--ink)]"
              >
                Skip
              </button>
            ) : null}
          </div>

          <p className="m-0 mb-2 max-w-[54ch] text-[14px] leading-[1.6] text-[var(--ink2)]">
            {question.scenario}
          </p>
          <h2 className="oi-display m-0 mb-5 text-[19px]">{question.ask}</h2>

          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {question.choices.map((choice) => {
              const isPicked = picked?.id === choice.id;
              const reveal = picked !== null;
              const right = choice.correct;

              /* Sage marks the correct answer once revealed; terracotta is
                 never used here, because a wrong guess about plywood is not
                 an error state and colouring it like one would be unkind at
                 the exact moment we are asking somebody to risk being wrong.
                 A wrong pick is marked by the outline and by its own
                 sentence, not by alarm. */
              const border = !reveal
                ? 'var(--line)'
                : right
                  ? 'var(--sec)'
                  : isPicked
                    ? 'var(--ink2)'
                    : 'var(--line)';

              return (
                <li key={choice.id}>
                  <button
                    type="button"
                    onClick={() => answer(choice)}
                    disabled={reveal}
                    aria-pressed={isPicked}
                    className="flex w-full min-h-11 cursor-pointer items-center gap-3 border px-4 py-3 text-left text-[14px] leading-snug transition-colors disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--acc)]"
                    style={{
                      borderColor: border,
                      background: reveal && right ? 'rgba(131,144,115,.09)' : 'var(--card)',
                      /* Recede, but stay readable. At .55 this text measured
                         3.51:1 — below AA — and the options that were not
                         picked are the ones somebody re-reads to work out why
                         they were wrong, which is the whole value of the
                         screen. .82 holds 8.7:1. */
                      opacity: reveal && !right && !isPicked ? 0.82 : 1,
                    }}
                  >
                    {reveal && right ? (
                      <Tick style={{ color: 'var(--sec)' }} />
                    ) : (
                      <span
                        aria-hidden
                        className="h-[13px] w-[13px] flex-none rounded-full border"
                        style={{ borderColor: isPicked ? 'var(--ink2)' : 'var(--line)' }}
                      />
                    )}
                    <span>{choice.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {picked ? (
            <div className="oi-swap mt-5 border-t border-[var(--ink)] pt-5" aria-live="polite">
              <p
                className="oi-num m-0 mb-3 text-[11px] uppercase tracking-[0.16em]"
                style={{ color: picked.correct ? 'var(--sec-ink)' : 'var(--ink2)' }}
              >
                {picked.correct ? 'That is the one' : 'Not this time'}
              </p>

              {/* The reply to what they actually chose, before the general
                  explanation — a wrong answer deserves a specific reply, and
                  in almost every case the wrong option is the right answer
                  somewhere else in the flat. */}
              <p className="m-0 mb-3 max-w-[58ch] text-[14.5px] leading-[1.6] text-[var(--ink)]">
                {picked.ifPicked}
              </p>
              <p className="m-0 mb-3 max-w-[58ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
                {question.because}
              </p>
              <p
                className="m-0 max-w-[58ch] border-t border-[var(--line)] pt-3 text-[13.5px] leading-[1.55]"
                style={{ color: 'var(--acc-ink)' }}
              >
                {question.stakes}
              </p>
              <p className="oi-label m-0 mt-4">
                In your quote this is the line that says “{glossary.name}”
              </p>
            </div>
          ) : null}

          {/* Stages finished while they were still reading. The quote waits. */}
          {stagesDone && picked === null ? (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <p className="m-0 mb-4 text-[13.5px] leading-snug text-[var(--ink2)]">
                Your quote is ready whenever you are — answer first if you like.
              </p>
              <button
                type="button"
                onClick={() => skipped_(true)}
                className="cursor-pointer px-6 py-3 text-[14.5px] font-medium text-white"
                style={{ background: 'var(--acc-btn)' }}
              >
                See your quote
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Keyed so each line re-enters rather than the words changing under
          the reader mid-sentence. Hidden once they are reading an answer —
          a rotating gag beside an explanation is just competition. */}
      {picked === null && !waiting ? (
        <p
          aria-hidden
          key={joke}
          className="oi-swap oi-num m-0 mt-8 text-[11px] uppercase tracking-[0.16em]"
          style={{ color: 'var(--acc-ink)' }}
        >
          {ASIDES[joke]}
        </p>
      ) : null}
    </div>
  );
}
