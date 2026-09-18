'use client';

/**
 * The product, step by step — five screens, one tap at a time.
 *
 * ## Why this replaces the film band
 *
 * The band it replaces was a play button over a photograph, for a film that
 * does not exist. Even once it does, a 90-second video asks for 90 seconds
 * before it gives anything back, and the thing it would show is five screens
 * — which the page can simply show, immediately, and let somebody skip to
 * the one they care about.
 *
 * ## Click-selected, deliberately
 *
 * The prototype rotated these on an interval and it read as broken: the
 * frame you were reading was taken away, and when the rotation stalled the
 * frozen frame looked like a failed load. So there is no timer here at all.
 * If auto-advance is ever added, click selection stays primary and it must
 * pause on interaction — same rule as everything else on this page.
 *
 * ## Why the snapshots come from the spine
 *
 * `snapshots.tsx`, with `compact`. Drawing a second set for this frame would
 * mean the ₹ figures, the roster count and the material specs existed twice,
 * and two versions of the same number on one page is precisely the problem
 * this site sells against.
 */

import { useId, useState } from 'react';
import Image from 'next/image';
import { PHOTOS } from '@/lib/imagery';
import { Wrap, Eyebrow, Heading } from './parts';
import { SNAPSHOTS } from './snapshots';

const STEPS = [
  { name: 'OneQuiz', note: 'nine questions, no phone number' },
  { name: 'OneMatch', note: 'scored against your answers' },
  { name: 'OneQuote', note: 'priced off their rate card in seconds' },
  { name: 'OneCompare', note: 'quotes and materials side by side' },
  { name: 'OneExpert', note: 'your architect, through handover' },
] as const;

export function Walkthrough() {
  const [at, setAt] = useState(0);
  const panelId = useId();

  return (
    <section id="walkthrough" data-on-dark className="relative overflow-hidden">
      <Image
        src={PHOTOS.verification.src}
        alt=""
        aria-hidden
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(200deg,rgba(28,21,17,.72),rgba(28,21,17,.9))' }}
      />

      <Wrap className="relative py-16 sm:py-20">
        <div
          className="grid items-start gap-x-12 gap-y-10"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}
        >
          {/* ── Left: the five steps ── */}
          <div>
            <Eyebrow onDark>The product, step by step</Eyebrow>
            <Heading className="max-w-[18ch] text-[#fcfcfa]">
              This is the whole thing, one tap at a time.
            </Heading>
            <p className="m-0 mb-9 mt-5 max-w-[52ch] text-[15px] leading-[1.65] text-white/75">
              Brief, match, quote, compare, architect. Pick any step and the real screen appears
              alongside — no sales call anywhere in it, and nothing payable by you at any point.
            </p>

            <p className="oi-num m-0 mb-3 text-[10.5px] uppercase tracking-[0.18em] text-white/55">
              Tap a step
            </p>

            {/* A toggle group, not a tablist — `role="tab"` would promise
                arrow-key navigation that is not implemented. `aria-pressed`
                says what these actually are: five buttons, one held down. */}
            <div role="group" aria-label="The five product steps" className="flex flex-col gap-1">
              {STEPS.map((step, i) => {
                const on = i === at;
                return (
                  <button
                    key={step.name}
                    type="button"
                    aria-pressed={on}
                    aria-controls={panelId}
                    onClick={() => setAt(i)}
                    // py-3, not the handoff's 9px: at 9px these rows are
                    // ~40px tall and WCAG 2.5.5 wants 44. They are the
                    // primary control of the section and get tapped on a
                    // phone.
                    className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-full border-0 px-3 py-3 text-left transition-colors"
                    style={{ background: on ? 'rgba(252,252,250,.12)' : 'transparent' }}
                  >
                    <span
                      aria-hidden
                      className="h-2 w-2 flex-none rounded-full"
                      style={{ background: 'var(--acc)', opacity: on ? 1 : 0.28 }}
                    />
                    <span
                      className="text-[15px]"
                      style={{ color: on ? '#fcfcfa' : 'rgba(255,255,255,.75)' }}
                    >
                      {step.name}
                      <span className="text-white/60"> — {step.note}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right: the glass frame ──
              One panel holding all five scenes rather than five tab panels:
              the scenes are illustrations of the step that is already
              selected, and four hidden panels in the tab order would make a
              keyboard reader hunt through them. */}
          <div
            id={panelId}
            aria-live="polite"
            aria-label="The screen for the step you picked"
            className="oi-stack min-h-[470px] p-[clamp(18px,3vw,34px)]"
            style={{
              borderRadius: 26,
              border: '1px solid rgba(252,252,250,.22)',
              background: 'rgba(36,29,26,.5)',
              backdropFilter: 'blur(22px) saturate(1.15)',
              WebkitBackdropFilter: 'blur(22px) saturate(1.15)',
              boxShadow:
                '0 40px 80px -40px rgba(0,0,0,.6), inset 0 1px 0 rgba(252,252,250,.16)',
            }}
          >
            {SNAPSHOTS.map((Snap, i) => (
              <div key={STEPS[i]!.name} data-on={i === at} aria-hidden={i !== at}>
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <span className="oi-display text-[17px] text-[#fcfcfa]">{STEPS[i]!.name}</span>
                  <span className="oi-num text-[10px] uppercase tracking-[0.16em] text-white/50">
                    Step {String(i + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
                  </span>
                </div>

                <Snap compact />
              </div>
            ))}
          </div>
        </div>
      </Wrap>
    </section>
  );
}
