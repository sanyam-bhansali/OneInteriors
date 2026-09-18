'use client';

/**
 * How it works — a pinned scroll sequence.
 *
 * The section holds the viewport while you scroll through all five steps, then
 * releases and the page carries on to the next section.
 *
 * ## How the pinning works, and why it is not scroll-jacking
 *
 * There is a tall outer track — five screens of it — and inside that a stage
 * that is `position: sticky; top: 0; height: 100dvh`. Scrolling moves the page
 * normally; the stage simply stays put while its track passes behind it. How
 * far through the track you are decides which step is showing.
 *
 * That distinction matters. The other way to build this is to intercept the
 * wheel event and animate the section yourself, which breaks the scrollbar,
 * breaks trackpad momentum, breaks Page Down, breaks find-in-page and makes
 * the back button feel wrong. Here every one of those still works, because the
 * browser is still doing the scrolling. Nothing is hijacked — the page is just
 * taller than it looks.
 *
 * ## Why the whole sequence gets five screens
 *
 * One screen per step. Less and the snapshots flick past before you can read
 * a quote line; more and the reader starts to wonder whether the page is
 * broken. Five is about four seconds of unhurried scrolling, which is the
 * length of the argument being made.
 *
 * ## Motion
 *
 * The active step brightens and slides a few pixels; the outgoing snapshot
 * fades down and out while the incoming one rises. A progress rail fills as
 * you go, so at any moment it is obvious how much of this is left — the single
 * most important reassurance a pinned section can give, because a reader who
 * cannot tell how long they are stuck for scrolls away.
 *
 * Every one of those effects is skipped under `prefers-reduced-motion`, where
 * the snapshots simply swap. Vestibular disorders are common and a pinned,
 * parallaxing section is one of the worst offenders on the web.
 *
 * ## Mobile
 *
 * No pinning below `lg`. A sticky full-height stage on a phone fights the
 * browser's own collapsing address bar and costs `100dvh` of certainty, and
 * two columns do not fit anyway. It stacks: each step with its own snapshot
 * beneath it, in order, nothing dropped.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { PHOTOS } from '@/lib/imagery';
import { Wrap, Eyebrow, Heading, Cta } from './parts';
import { QuizSnap, MatchSnap, QuoteSnap, CompareSnap, ExpertSnap } from './snapshots';

interface Step {
  n: string;
  name: string;
  body: string;
  Snap: () => React.ReactElement;
}

const STEPS: Step[] = [
  {
    n: '01',
    name: 'OneQuiz',
    body: 'Nine questions fill in your flat — area, rooms, budget band.',
    Snap: QuizSnap,
  },
  {
    n: '02',
    name: 'OneMatch',
    body: 'Fourteen eligible studios narrow to three, scored and checked.',
    Snap: MatchSnap,
  },
  {
    n: '03',
    name: 'OneQuote',
    body:
      "One click. We price your brief off each studio's own rate card and hand you the first quote in three seconds.",
    Snap: QuoteSnap,
  },
  {
    n: '04',
    name: 'OneCompare',
    body: 'Quotes and materials side by side — board, shutter, hardware.',
    Snap: CompareSnap,
  },
  {
    n: '05',
    name: 'OneExpert',
    body: 'A personal architect, assigned to you, verifying every step.',
    Snap: ExpertSnap,
  },
];

/**
 * How much scroll each step costs.
 *
 * It was 1.0 — five whole screens, plus one for the stage, which meant six
 * screenfuls of scrolling to get past a single section with no way out. That
 * is the standard failure of a pinned section: it is built for the reader who
 * wants the tour and charges the same toll to the one who does not.
 *
 * 0.75 is enough travel to read a quote line without rushing and takes about a
 * third off the total. The escape hatch below fixes the rest.
 */
const SCREENS_PER_STEP = 0.75;

export function HowItWorks() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  /** 0 → 1 across the whole sequence. Drives the rail and the parallax. */
  const [progress, setProgress] = useState(0);
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setCalm(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  /**
   * Where we are inside the track.
   *
   * `travel` is the scrollable distance — the track's height minus the one
   * screen the stage occupies. Dividing by it gives 0 at the moment the stage
   * pins and 1 at the moment it releases, which is exactly the range the
   * sequence should play over.
   */
  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const el = track.current;
      if (!el) return;

      const box = el.getBoundingClientRect();
      const travel = box.height - window.innerHeight;
      if (travel <= 0) return;

      const p = Math.min(1, Math.max(0, -box.top / travel));
      setProgress(p);

      // `p * STEPS.length` reaches exactly 5 at the very end, which would
      // index past the array — hence the min.
      setActive(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length)));
    };

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  /** Clicking a step scrolls to the point in the track where it begins. */
  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const travel = el.offsetHeight - window.innerHeight;
    const top = el.offsetTop + (travel * (i + 0.5)) / STEPS.length;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  /** Past the whole track, to whatever comes next. */
  const skip = useCallback(() => {
    const el = track.current;
    if (!el) return;
    window.scrollTo({ top: el.offsetTop + el.offsetHeight, behavior: 'smooth' });
  }, []);

  const Active = STEPS[active]!.Snap;

  return (
    // Alabaster. It sits between the Raw Silk evidence board above and the
    // Deep Espresso trust band below, so every boundary on the page is a
    // change of material rather than a hairline on the same ground.
    <section id="how-it-works" className="bg-[var(--card)]">
      {/* ── Phones: no pinning, everything stacked ── */}
      <div className="py-16 lg:hidden">
        <Wrap>
          <Eyebrow>How it works</Eyebrow>
          <Heading className="mb-10 max-w-[26ch]">
            Five steps, and you can see each one working.
          </Heading>

          <ol className="m-0 flex list-none flex-col p-0">
            {STEPS.map((step) => {
              const Snap = step.Snap;
              return (
                <li key={step.name} className="border-t border-[var(--line)] py-7 first:border-t-0">
                  <span className="mb-2 flex items-baseline gap-3">
                    <span className="oi-num text-[11px] text-[var(--acc)]">{step.n}</span>
                    <span className="oi-display text-[1.6rem]">{step.name}</span>
                  </span>
                  <p className="m-0 mb-5 max-w-[44ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
                    {step.body}
                  </p>
                  <div className="oi-glass p-3">
                    <Snap />
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-10">
            <Cta href="/quiz">Start with nine questions</Cta>
          </div>
        </Wrap>
      </div>

      {/* ── Desktop: the pinned track ── */}
      <div
        ref={track}
        className="relative hidden lg:block"
        style={{ height: `${STEPS.length * SCREENS_PER_STEP * 100 + 100}vh` }}
      >
        <div className="sticky top-0 flex h-[100dvh] flex-col justify-center overflow-hidden">
          <Wrap>
            <div className="mb-7 flex items-end justify-between gap-10">
              <div>
                <Eyebrow>How it works</Eyebrow>
                <Heading className="max-w-[26ch]">
                  Five steps, and you can see each one working.
                </Heading>
              </div>

              <div className="flex flex-none items-center gap-5 pb-1">
                {/* "Keep scrolling" is doing real work, not decoration. A
                    pinned section stops the page moving, and the honest read
                    of a page that has stopped moving is that it has broken.
                    Saying how many steps are left, and that scrolling is
                    still the right thing to do, is what turns a stuck page
                    back into a sequence. */}
                <p className="oi-num m-0 whitespace-nowrap text-[11px] uppercase tracking-[0.16em] text-[var(--ink2)]">
                  Step {STEPS[active]!.n} / {String(STEPS.length).padStart(2, '0')}
                  <span className="hidden sm:inline"> · keep scrolling</span>
                </p>

                {/* The way out.
                    A pinned section without one is a section that has decided
                    how long you are staying. This is deliberately quiet — the
                    sequence is worth watching — but it is there from the first
                    frame, and it is the difference between a reader who skips
                    a section and a reader who leaves the page. */}
                <button
                  type="button"
                  onClick={skip}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[var(--ink2)] underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline"
                >
                  Skip ahead ↓
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] items-center gap-12">
              {/* ── The spine ── */}
              <div className="flex gap-6">
                {/* The progress rail. The single most important thing a pinned
                    section can show: how much of this is left. */}
                <div
                  aria-hidden
                  className="relative w-px flex-none bg-[var(--line)]"
                >
                  <div
                    className="absolute inset-x-0 top-0 origin-top bg-[var(--acc)]"
                    style={{
                      height: `${progress * 100}%`,
                      transition: calm ? 'none' : 'height .12s linear',
                    }}
                  />
                </div>

                <ol className="m-0 flex list-none flex-col gap-1 p-0">
                  {STEPS.map((step, i) => {
                    const on = i === active;
                    const past = i < active;

                    return (
                      <li key={step.name}>
                        <button
                          type="button"
                          onClick={() => goTo(i)}
                          aria-current={on ? 'step' : undefined}
                          className="w-full cursor-pointer border-0 bg-transparent p-0 py-2.5 text-left"
                          style={{
                            transform: calm ? 'none' : `translateX(${on ? 6 : 0}px)`,
                            transition: calm
                              ? 'none'
                              : 'transform .45s cubic-bezier(.22,.61,.36,1)',
                          }}
                        >
                          <span className="flex items-baseline gap-3">
                            <span
                              className="oi-num text-[11px]"
                              style={{
                                color: on ? 'var(--acc)' : 'var(--ink2)',
                                opacity: past ? 0.5 : 1,
                                transition: calm ? 'none' : 'color .4s ease, opacity .4s ease',
                              }}
                            >
                              {step.n}
                            </span>
                            <span
                              className="oi-display text-[clamp(1.5rem,1.1rem+1.1vw,2rem)]"
                              style={{
                                opacity: on ? 1 : 0.32,
                                transition: calm ? 'none' : 'opacity .45s ease',
                              }}
                            >
                              {step.name}
                            </span>
                          </span>

                          {/* The body copy belongs to the active step only.
                              Five paragraphs stacked would be five paragraphs
                              competing with the panel beside them. */}
                          <span
                            className="block overflow-hidden"
                            style={{
                              maxHeight: on ? '5.5rem' : '0rem',
                              opacity: on ? 1 : 0,
                              transition: calm
                                ? 'none'
                                : 'max-height .5s cubic-bezier(.22,.61,.36,1), opacity .35s ease',
                            }}
                          >
                            <span className="mt-2 block max-w-[42ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
                              {step.body}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* ── The frame ── */}
              <div className="relative overflow-hidden rounded-[26px]">
                <Image
                  src={PHOTOS.spine.src}
                  alt={PHOTOS.spine.alt}
                  width={900}
                  height={1100}
                  sizes="46vw"
                  className="h-[min(60dvh,600px)] w-full object-cover"
                  style={{
                    // A slow drift across the sequence. Six percent — enough
                    // to feel alive behind the glass, not enough to notice as
                    // an effect.
                    transform: calm ? 'none' : `scale(${1.06 - progress * 0.06})`,
                    transition: calm ? 'none' : 'transform .12s linear',
                  }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(200deg,rgba(44,38,36,.34),rgba(44,38,36,.56))',
                  }}
                />

                {/* `overflow-y-auto` on the card is a guard, not a feature.
                    At 1280x640 — an ordinary laptop with browser chrome — the
                    stage has barely 380px for the frame, and the densest
                    snapshot (the quote, with four line items and a total) is
                    taller than that. Without this it is silently clipped by
                    the frame's own `overflow-hidden` and the total disappears,
                    which is the one number that snapshot exists to show. */}
                <div className="absolute inset-0 flex items-center justify-center p-5 xl:p-7">
                  <div
                    /* `tabIndex={0}` because this scrolls. A region with
                       `overflow: auto` that cannot take focus cannot be
                       scrolled with a keyboard at all — the content below the
                       fold is simply unreachable without a mouse. WCAG 2.1.1.
                       It only ever scrolls on a short viewport, but "only
                       sometimes unreachable" is still unreachable. */
                    tabIndex={0}
                    role="group"
                    aria-label={`${STEPS[active]!.name} — what you see`}
                    className="oi-glass oi-rail max-h-full w-full max-w-[410px] overflow-y-auto p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="oi-label m-0">One Interiors</span>
                      <span className="oi-label m-0">{STEPS[active]!.name}</span>
                    </div>

                    {/* Keyed on the step so React remounts and the animation
                        replays, rather than mutating the old card field by
                        field into the new one. */}
                    <div key={active} className={calm ? undefined : 'snap-in'}>
                      <Active />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <Cta href="/quiz">Start with nine questions</Cta>
            </div>
          </Wrap>
        </div>
      </div>
    </section>
  );
}
