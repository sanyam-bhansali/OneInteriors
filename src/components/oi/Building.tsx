'use client';

/**
 * The ten seconds while a quote is built.
 *
 * ## Why this is slow on purpose, and why that is not a lie
 *
 * The arithmetic takes milliseconds. Showing a forty-line quotation instantly
 * would be technically honest and commercially useless: a number that appears
 * the instant you ask for it reads as a number nobody worked out. Everyone in
 * this market has been trained by three weeks of waiting to believe a real
 * quote is slow, and a product that beats that by six orders of magnitude has
 * to spend a few seconds showing its working or the result is not believed.
 *
 * The stages are real work, named as it happens. The one line that must never
 * appear is a fake percentage tied to nothing.
 *
 * ## What this screen used to be, and why it is not that
 *
 * It was a stage list, a rotating joke, a scenario, a question, three long
 * options and three paragraphs of explanation — all at once, all in text. It
 * was accurate and it was a wall. Somebody waiting on a price for their own
 * home is excited and slightly nervous; handing them an essay at that moment
 * is not thoroughness, it is homework, and they stop reading.
 *
 * So the wait is now **one thing at a time, arriving**. A thin progress line
 * carries the work. Above it, illustrated cards land one after another — a
 * drawing, six words, one figure — and the last of them is a short question.
 * Each card is about four seconds of attention and no card asks for more.
 *
 * ## What must never happen
 *
 * The quote must not be taken away from somebody mid-sentence. If the stages
 * finish while the question is unanswered, the answer waits on an explicit
 * press. The ten seconds are a floor, not a deadline. Equally the question is
 * never a toll gate — skipping is always one press away and costs nothing.
 *
 * ## Accessibility
 *
 * The stage sentence is the real progress indicator and is announced politely.
 * The jokes are `aria-hidden` — a rotating gag read over a status message is
 * noise. Every entrance animation is off under `prefers-reduced-motion`; the
 * cards still change, because they are content and not decoration.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MATERIALS, type Material } from '@/modules/materials/glossary';
import { pickQuestion, type Choice } from '@/modules/materials/quiz';
import { MaterialCard } from './Material';

export interface Stage {
  /** What is happening, in the present tense. */
  label: string;
  /** Milliseconds this stage holds for. */
  ms: number;
}

/**
 * Ten and a half seconds, weighted towards the two stages that sound like the
 * hard parts — reading the plan and pricing off the rate card — because those
 * are the two a customer would expect to take the longest.
 */
export const DEFAULT_STAGES: Stage[] = [
  { label: 'Reading your floor plan', ms: 2600 },
  { label: 'Measuring the kitchen platform run', ms: 1700 },
  { label: 'Sizing each room against the standard template', ms: 1800 },
  { label: 'Applying the studio’s own filed rates', ms: 2600 },
  { label: 'Writing the quotation, line by line', ms: 1800 },
];

/**
 * The jokes, reduced to one quiet line under the progress.
 *
 * They used to compete with everything else on the screen for attention and
 * none of it won. Every one is about the wait everybody else makes you do —
 * never about the customer, their budget or their taste.
 */
const ASIDES = [
  'Three weeks, down to ten seconds.',
  'Not phoning anyone. Not even once.',
  'No “ma’am, please visit our office”.',
  'Measuring in millimetres, like a grown-up.',
  'Resisting the urge to write “premium ply”.',
  'Every line is getting a quantity.',
  'No WhatsApp forward is being prepared.',
  'Checking that “soft-close” means something.',
];

/** When each card lands. The first is held back so nothing arrives at once. */
const CARD_AT = [900, 3500] as const;
const QUESTION_AT = 6100;

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
  const [slide, slide_] = useState(-1);
  const [joke, joke_] = useState(0);
  const [picked, picked_] = useState<Choice | null>(null);
  const [skipped, skipped_] = useState(false);

  /**
   * Picked once, from the values held at mount.
   *
   * Both arrive from a parent that re-renders on every stage tick, and
   * `seenQuestions` is typically a fresh array each time. Depending on them
   * would re-roll the question under somebody mid-read, which is the one thing
   * this screen must never do. `onAsked` goes in a ref for the same reason.
   */
  const seenAtMount = useRef(seenQuestions);
  const asked = useRef(onAsked);
  asked.current = onAsked;

  const question = useMemo(() => pickQuestion(studioName, seenAtMount.current), [studioName]);

  /**
   * Two cards, and never one the question is about.
   *
   * Showing the answer two cards before asking for it turns a question into a
   * memory test, which is a different and much less interesting thing.
   */
  const cards: Material[] = useMemo(() => {
    const pool = MATERIALS.filter((m) => m.id !== question.materialId);
    let hash = 0;
    for (let i = 0; i < studioName.length; i += 1) hash = (hash * 31 + studioName.charCodeAt(i)) | 0;
    const start = Math.abs(hash) % pool.length;
    return [pool[start]!, pool[(start + 5) % pool.length]!];
  }, [studioName, question.materialId]);

  const stagesDone = at >= stages.length;
  /** -1 nothing yet, 0..n-1 a card, n the question. */
  const onQuestion = slide >= cards.length;

  // Walk the stages on their own timings. One timeout per stage rather than an
  // interval, so a stage meant to take 2.6s does.
  useEffect(() => {
    if (stagesDone) return;
    const t = setTimeout(() => at_((i) => i + 1), stages[at]!.ms);
    return () => clearTimeout(t);
  }, [at, stages, stagesDone]);

  // The slides, on their own clock — independent of the stages, so a slow
  // machine does not land two cards on top of each other.
  useEffect(() => {
    const timers = [
      ...CARD_AT.map((ms, i) => setTimeout(() => slide_((s) => Math.max(s, i)), ms)),
      setTimeout(() => {
        slide_((s) => Math.max(s, CARD_AT.length));
        asked.current?.(question.id);
      }, QUESTION_AT),
    ];
    return () => timers.forEach(clearTimeout);
  }, [question.id]);

  /**
   * Hand over only when the stages have finished AND the reader is not in the
   * middle of the question. A short beat after an answer so the result is seen
   * rather than flashed.
   */
  useEffect(() => {
    if (!stagesDone) return;
    if (!onQuestion) return;
    if (picked === null && !skipped) return;
    const t = setTimeout(() => onDone?.(), 1000);
    return () => clearTimeout(t);
  }, [stagesDone, onQuestion, picked, skipped, onDone]);

  // Stages finished before the question was even reached — nothing to read, so
  // nobody is being interrupted.
  useEffect(() => {
    if (stagesDone && !onQuestion) onDone?.();
  }, [stagesDone, onQuestion, onDone]);

  useEffect(() => {
    const t = setInterval(() => joke_((j) => (j + 1) % ASIDES.length), 2600);
    return () => clearInterval(t);
  }, []);

  const answer = useCallback(
    (choice: Choice) => {
      if (picked) return;
      picked_(choice);
    },
    [picked],
  );

  /** How far through, by time budgeted rather than stages counted. */
  const total = stages.reduce((sum, s) => sum + s.ms, 0);
  const elapsed = stages.slice(0, at).reduce((sum, s) => sum + s.ms, 0);
  const pct = Math.min(100, Math.round((elapsed / total) * 100));
  const current = stages[Math.min(at, stages.length - 1)]!;

  return (
    <div className="mx-auto w-full max-w-[38rem] py-12">
      <p className="oi-eyebrow m-0 mb-3">Building your first quote</p>
      <h1 className="oi-display m-0 mb-8 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]">
        Pricing {studioName} on your flat.
      </h1>

      {/* ── The work, as one line and a bar ── */}
      <div className="mb-8">
        <div className="mb-2.5 flex items-baseline justify-between gap-4">
          <p className="m-0 text-[13.5px] text-[var(--ink2)]" aria-live="polite">
            {stagesDone ? 'Quotation ready' : current.label}
          </p>
          <span className="oi-num text-[11px] tracking-[0.1em] text-[var(--ink2)]">
            {stagesDone ? '100%' : `${pct}%`}
          </span>
        </div>
        <div className="h-[3px] w-full bg-[var(--line)]">
          <div
            className="oi-progress h-full"
            /* --acc-ink, not --acc: the raw terracotta is 2.87:1 on the
               hairline track it runs in, which fails 1.4.11 for a graphic
               that is carrying the only progress information on screen. */
            style={{ width: `${stagesDone ? 100 : pct}%`, background: 'var(--acc-ink)' }}
          />
        </div>
      </div>

      {/* ── The shower ── */}
      <div className="min-h-[22rem]">
        {slide < 0 ? null : onQuestion ? (
          <section
            key="q"
            className="oi-card-in border border-[var(--line)] bg-[var(--card)] p-[clamp(18px,3vw,26px)]"
            aria-label="One question while you wait"
          >
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="oi-eyebrow m-0">Your turn</p>
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

            <h2 className="oi-display m-0 mb-5 text-[19px] leading-snug">{question.ask}</h2>

            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {question.choices.map((choice) => {
                const isPicked = picked?.id === choice.id;
                const reveal = picked !== null;
                const right = choice.correct;

                /* Sage marks the correct answer once revealed; terracotta is
                   never used here, because a wrong guess about plywood is not
                   an error state and colouring it like one would be unkind at
                   the exact moment we are asking somebody to risk being wrong. */
                return (
                  <li key={choice.id}>
                    <button
                      type="button"
                      onClick={() => answer(choice)}
                      disabled={reveal}
                      aria-pressed={isPicked}
                      className="flex w-full min-h-11 cursor-pointer items-center gap-3 border px-4 py-3 text-left text-[14.5px] leading-snug transition-colors disabled:cursor-default"
                      style={{
                        borderColor: !reveal
                          ? 'var(--line)'
                          : right
                            ? 'var(--sec)'
                            : isPicked
                              ? 'var(--ink2)'
                              : 'var(--line)',
                        background: reveal && right ? 'rgba(131,144,115,.11)' : 'var(--card)',
                        opacity: reveal && !right && !isPicked ? 0.82 : 1,
                      }}
                    >
                      <span
                        aria-hidden
                        className="h-[10px] w-[10px] flex-none rounded-full border"
                        style={{
                          borderColor: reveal && right ? 'var(--sec)' : 'var(--line)',
                          background: reveal && right ? 'var(--sec)' : 'transparent',
                        }}
                      />
                      <span>{choice.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {picked ? (
              <div className="oi-swap mt-5 border-t border-[var(--line)] pt-4" aria-live="polite">
                <p
                  className="oi-num m-0 mb-2 text-[10.5px] uppercase tracking-[0.16em]"
                  style={{ color: picked.correct ? 'var(--sec-ink)' : 'var(--ink2)' }}
                >
                  {picked.correct ? 'That is the one' : 'Not this time'}
                </p>
                {/* The reply to what they actually chose comes first, because
                    a wrong answer deserves a specific reply — and in almost
                    every case the wrong option is the right answer somewhere
                    else in the flat. */}
                <p className="m-0 mb-2 max-w-[52ch] text-[14.5px] leading-[1.55]">
                  {picked.ifPicked}
                </p>
                <p className="m-0 max-w-[52ch] text-[14px] leading-[1.55] text-[var(--ink2)]">
                  {question.because}
                </p>
                <p className="oi-num m-0 mt-3 text-[13px]" style={{ color: 'var(--acc-ink)' }}>
                  {question.stakes}
                </p>
              </div>
            ) : null}

            {/* Stages finished while they were still reading. The quote waits. */}
            {stagesDone && picked === null ? (
              <div className="mt-5 border-t border-[var(--line)] pt-4">
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
        ) : (
          <section
            key={cards[slide]!.id}
            className="oi-card-in border border-[var(--line)] bg-[var(--card)] p-[clamp(18px,3vw,26px)]"
            aria-label="While you wait"
          >
            <p className="oi-eyebrow m-0 mb-4">Worth knowing about your quote</p>
            <MaterialCard material={cards[slide]!} compact />
          </section>
        )}
      </div>

      {/* Where you are in the sequence. Three dots, so the shower has a visible
          end — an indefinite stream of cards is a thing to escape, and a
          sequence of three is a thing to finish. */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <ul className="m-0 flex list-none items-center gap-2 p-0" aria-hidden>
          {[...cards, null].map((_, i) => (
            <li
              key={i}
              className="h-[5px] transition-all duration-500"
              style={{
                width: slide === i ? 20 : 5,
                background: slide >= i ? 'var(--ink2)' : 'var(--line)',
              }}
            />
          ))}
        </ul>

        {/* Keyed so each line re-enters rather than the words changing under
            the reader mid-sentence. Gone once they are reading an answer. */}
        {picked === null ? (
          <p
            aria-hidden
            key={joke}
            className="oi-swap oi-num m-0 text-right text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink2)]"
          >
            {ASIDES[joke]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
