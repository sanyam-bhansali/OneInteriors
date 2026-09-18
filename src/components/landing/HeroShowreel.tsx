'use client';

/**
 * The hero showreel.
 *
 * Six finished flats cross-fade behind the headline, with the caption bottom
 * right naming whichever one is on screen and a filmstrip down the right edge
 * showing where you are in the reel.
 *
 * ## Why the caption has to move with the photograph
 *
 * It was static — one still, one caption — and that was defensible while there
 * was only one photograph. The moment the picture changes, a fixed caption is
 * a label attached to the wrong thing, which is worse than no label. So the
 * two are driven by the same index and cannot drift.
 *
 * ## Why this one is allowed to move on its own
 *
 * The rest of the page does not: no auto-advancing testimonial, no
 * self-opening accordion, because taking away something a reader is reading is
 * rude. A showreel is the exception and the name says why — it stands in for
 * the film that will eventually play here, and a film that waits to be asked
 * is a poster. There is nothing to read in it, so nothing is taken away.
 *
 * It still stops for two things: a viewer who asked for reduced motion, and a
 * tab that is not on screen. The second is not politeness, it is battery —
 * `setInterval` plus image decoding in a background tab is exactly the kind of
 * thing that makes a laptop warm for no reason.
 *
 * ## Loading
 *
 * Only the first frame is `priority`. It is the LCP element and the other five
 * are worthless until seconds later; marking them all high priority would have
 * six photographs competing for the connection while the one that matters
 * waits its turn.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { FINISHED_WORK } from '@/lib/imagery';
import { Wrap } from './parts';

/** How long each frame holds. Long enough to look at, short enough to notice. */
const HOLD_MS = 5200;

export function HeroShowreel() {
  const [at, setAt] = useState(0);
  const [calm, setCalm] = useState(false);
  /**
   * Whether the reel is paused, and it is STATE rather than a ref now.
   *
   * WCAG 2.2.2 (Pause, Stop, Hide): content that moves automatically, runs
   * for more than five seconds and sits alongside other content needs a
   * mechanism to stop it. Picking a thumbnail already stopped the reel — but
   * that button announces itself as "Show Kotah & cane, Kothrud", so nobody
   * could know it was also the pause control. A mechanism nobody can find is
   * not a mechanism.
   */
  const [paused, setPaused] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  /** False once the hero has scrolled away. See the note on the observer. */
  const [onScreen, setOnScreen] = useState(true);

  /**
   * Stop when the hero is not being looked at.
   *
   * The hidden-tab check below only catches a backgrounded tab. A reader
   * three sections down the page still had six photographs cross-fading and
   * decoding above them, forever — invisible work, real battery. This is the
   * other half of that.
   */
  useEffect(() => {
    const el = frame.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting ?? true),
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setCalm(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (calm || !onScreen || paused) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => setAt((i) => (i + 1) % FINISHED_WORK.length), HOLD_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    // The reel waits for the intro to finish. Starting at zero would have the
    // photograph changing while the wordmark is still over it, and the two
    // motions read as one confused thing rather than two clear ones.
    const kickoff = setTimeout(start, 2600);

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(kickoff);
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [calm, onScreen, paused]);

  /** Picking a frame stops the reel. Nobody wants the thing they chose taken away. */
  const pick = useCallback((i: number) => {
    setPaused(true);
    setAt(i);
  }, []);

  const shown = FINISHED_WORK[at]!;

  return (
    <>
      {/* ── The frames ── */}
      <div ref={frame} className="hero-photo absolute inset-0">
        {FINISHED_WORK.map((project, i) => (
          <Image
            key={project.photo.src}
            src={project.photo.src}
            /* Every frame is decorative. The first one used to carry real
               alt text, which meant a screen reader described the living room
               while frame four — a kitchen — was on screen. The caption below
               names whichever project is showing and is the accessible
               description of this whole block. */
            alt=""
            aria-hidden
            fill
            priority={i === 0}
            loading={i === 0 ? undefined : 'lazy'}
            sizes="100vw"
            className="object-cover"
            style={{
              opacity: i === at ? 1 : 0,
              // Instant for anyone who asked for less motion. Stopping the
              // auto-advance but keeping a one-and-a-half-second crossfade
              // on every thumbnail press honours half the request.
              transition: calm ? 'none' : 'opacity 1400ms cubic-bezier(.4,0,.2,1)',
            }}
          />
        ))}
      </div>

      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(44,38,36,.88) 0%, rgba(44,38,36,.55) 42%, rgba(44,38,36,.30) 72%, rgba(44,38,36,.42) 100%)',
        }}
      />

      {/* ── The filmstrip ──
          Bleeds off the right edge on purpose: it is a reel running past, not
          a set of six buttons demanding a decision. */}
      <div className="hero-caption absolute right-0 top-1/2 hidden -translate-y-1/2 lg:block">
        {!calm ? (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="mb-2.5 ml-auto flex h-7 w-[78px] cursor-pointer items-center justify-center gap-1.5 border-0 bg-black/35 text-[10px] uppercase tracking-[0.14em] text-white/85 backdrop-blur-sm transition-colors hover:bg-black/55"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {paused ? (
              <>
                <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor" aria-hidden="true">
                  <path d="M0 .6v7.8a.4.4 0 0 0 .62.33l6-3.9a.4.4 0 0 0 0-.66l-6-3.9A.4.4 0 0 0 0 .6Z" />
                </svg>
                Play
              </>
            ) : (
              <>
                <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor" aria-hidden="true">
                  <rect x="0" y="0.5" width="2.6" height="8" />
                  <rect x="5.4" y="0.5" width="2.6" height="8" />
                </svg>
                Pause
              </>
            )}
          </button>
        ) : null}

        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {FINISHED_WORK.map((project, i) => (
            <li key={project.photo.src}>
              <button
                type="button"
                onClick={() => pick(i)}
                aria-label={`Show ${project.title}, ${project.locality}`}
                aria-current={i === at ? 'true' : undefined}
                className="relative block h-[42px] w-[78px] cursor-pointer overflow-hidden border-0 p-0"
                style={{
                  opacity: i === at ? 1 : 0.42,
                  transform: `translateX(${i === at ? -10 : 0}px)`,
                  transition: calm ? 'none' : 'opacity .5s ease, transform .5s ease',
                }}
              >
                <Image
                  src={project.photo.src}
                  alt=""
                  width={160}
                  height={90}
                  sizes="78px"
                  className="h-full w-full object-cover"
                />
                {i === at ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-[2px]"
                    style={{ background: 'var(--acc)' }}
                  />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── The caption ──
          `key` on the inner block so it re-enters with the photograph rather
          than the words swapping underneath a crossfade. */}
      <div className="hero-caption pointer-events-none absolute inset-x-0 bottom-14 hidden lg:block">
        <Wrap>
          <div className="flex justify-end pr-[104px]">
            <div key={at} className={`text-right ${calm ? '' : 'snap-in'}`}>
              <p className="oi-num m-0 mb-3 text-[10.5px] uppercase tracking-[0.18em] text-white/65">
                Showreel · {String(FINISHED_WORK.length).padStart(2, '0')} projects
              </p>
              <p className="oi-display m-0 text-[22px] text-white">{shown.title}</p>
              <p className="oi-num m-0 mt-1 text-[10px] uppercase tracking-[0.16em] text-white/60">
                {shown.locality} · {shown.areaSqft.toLocaleString('en-IN')} sq ft · {shown.cost}
              </p>
            </div>
          </div>
        </Wrap>
      </div>
    </>
  );
}
