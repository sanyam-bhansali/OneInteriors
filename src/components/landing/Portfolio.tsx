'use client';

/**
 * Six flats, with what they cost printed on them — and a gate in front of the
 * seventh screen.
 *
 * ## Why the cost is on the card
 *
 * It is the entire reason this is not a mood gallery. Every competitor shows
 * finished rooms; almost nobody prints the figure beside one, because the
 * figure is what invites the comparison they would lose. The metadata block
 * underneath it does the same job in miniature: area and band beside the
 * total is the only way a reader can tell whether ₹18.4 L was a lot.
 *
 * ## Why clicking opens a gate rather than a project page
 *
 * A project page carries room-by-room photographs, the specification behind
 * each line and the quote that built it — and shown cold, to somebody who has
 * told us nothing, it is a brochure for somebody else's flat. Asking for the
 * brief first is what makes the page worth opening: it comes back matched.
 *
 * It is also honest about the exchange. The gate says what is behind it, says
 * it costs nothing and needs no phone number, and offers "Not now" as a real
 * way out rather than a corner cross.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FINISHED_WORK, type FinishedProject } from '@/lib/imagery';
import { Wrap, Eyebrow, Heading, Tick } from './parts';

/** Resting tilt per card, so the rail reads as prints on a table. */
const TILT = [-2.4, 1.6, -1.2, 2.2, -1.8, 1.1];

const CARD_STEP = 34; // gap, matching the rail below

// ── The gate ────────────────────────────────────────────────────

/**
 * A real dialog, not a div that looks like one.
 *
 * The prototype had none of this and it is the whole difference between a
 * modal and a trap: focus moves into the card and cannot leave it, Escape
 * closes, the background does not scroll underneath, the thing is labelled
 * so a screen reader announces what opened, and focus returns to the card
 * that opened it so a keyboard reader is not dumped at the top of the page.
 */
function Gate({
  project,
  onClose,
}: {
  project: FinishedProject;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;

    // Scroll lock. Restored to whatever it was rather than to '', because
    // something else on the page may legitimately own this.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    card.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = card.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(28,21,17,.66)', backdropFilter: 'blur(10px)' }}
    >
      {/* The backdrop is a button so a pointer click outside closes, but it is
          removed from the tab order — Escape and the two real buttons are the
          keyboard routes out, and a nameless full-screen tab stop is noise. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className="oi-glass relative w-[min(540px,100%)] p-[clamp(26px,4vw,38px)] outline-none"
        style={{
          background: 'rgba(247,242,234,.94)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          border: '1px solid rgba(252,252,250,.7)',
          boxShadow: '0 50px 90px -40px rgba(0,0,0,.6)',
        }}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <span
            className="oi-num text-[9.5px] uppercase tracking-[0.16em]"
            style={{ color: 'var(--acc-ink)' }}
          >
            Brief first
          </span>
          <button
            type="button"
            onClick={onClose}
            className="oi-num cursor-pointer border-0 bg-transparent p-0 text-[9.5px] uppercase tracking-[0.16em] text-[var(--ink2)] hover:text-[var(--ink)]"
          >
            Close ✕
          </button>
        </div>

        <h3 id={titleId} className="oi-display m-0 mb-4 text-[clamp(1.6rem,1.2rem+1.4vw,2.1rem)]">
          Tell us about your flat, and the full project opens.
        </h3>

        <p id={bodyId} className="m-0 mb-6 text-[14.5px] leading-[1.6] text-[var(--ink2)]">
          Project pages carry the room-by-room photographs, the specification behind each line, and
          the quote that built it. We open them once we know what you are planning — so you are
          reading a project matched to your home, not somebody else&rsquo;s.
        </p>

        <ul
          className="m-0 mb-6 flex list-none flex-col gap-3 p-0 py-5"
          style={{ borderTop: '1px solid #e2d9cb', borderBottom: '1px solid #e2d9cb' }}
        >
          {[
            'Room by room, with the material named on every element',
            'The actual line-by-line quote, and what moved during the build',
            'The studio that built it — and whether it fits your brief',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <Tick className="mt-0.5" style={{ color: 'var(--sec)' }} />
              <span className="text-[13.5px] leading-[1.5]">{line}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          {/* The project this was opened from travels with the link, so the
              quiz can bring them back to it rather than to a generic result. */}
          <Link
            href={`/quiz?from=${project.slug}`}
            className="oi-glass-inner inline-flex items-center justify-center px-6 py-3.5 text-[14.5px] font-medium text-white no-underline"
            style={{ background: 'var(--acc-btn)' }}
          >
            Start OneQuiz · 2 min
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="oi-glass-inner cursor-pointer bg-transparent px-5 py-3.5 text-[14.5px] font-medium text-[var(--ink)]"
            style={{ border: '1px solid var(--ink)' }}
          >
            Not now
          </button>
        </div>

        {/* --ink2, not the #9a8f86 in the handoff: that reads 2.83:1 on
            this warm glass and this is the line that answers "what does
            this cost me". */}
        <p className="oi-num m-0 mt-5 text-[9.5px] uppercase tracking-[0.16em] text-[var(--ink2)]">
          No phone number needed to start
        </p>
      </div>
    </div>
  );
}

// ── The rail ────────────────────────────────────────────────────

export function Portfolio() {
  const rail = useRef<HTMLDivElement>(null);
  const [gate, setGate] = useState<FinishedProject | null>(null);

  /**
   * Wheel over the rail moves the rail.
   *
   * Two rules, and both were learned by getting them wrong. It only claims a
   * gesture that is clearly vertical-intent-on-a-horizontal-thing
   * (`|deltaY| > |deltaX|`), and it hands the event back at either end — a
   * rail that swallows scroll at its last card is a rail the page cannot get
   * past, which on a phone reads as the site having frozen.
   */
  useEffect(() => {
    const el = rail.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
      if ((atStart && e.deltaY < 0) || (atEnd && e.deltaY > 0)) return;

      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const nudge = useCallback((direction: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const step = (card?.offsetWidth ?? 360) + CARD_STEP;
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  }, []);

  return (
    <section id="portfolio" className="border-t border-[var(--line)] py-16 sm:py-20">
      <Wrap>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Finished work · Pune</Eyebrow>
            <Heading className="max-w-[22ch]">
              Six flats, with what they cost printed on them.
            </Heading>
            <p className="m-0 mt-4 max-w-[54ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
              Scroll and the rail moves with you. Open any project and we will ask for your brief
              first — so what you see is matched to your home.
            </p>
          </div>

          <div className="flex gap-2">
            {([-1, 1] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => nudge(d)}
                aria-label={d === -1 ? 'Previous projects' : 'Next projects'}
                className="flex h-[52px] w-[52px] cursor-pointer items-center justify-center border border-[var(--line)] bg-[var(--card)] text-[var(--ink2)] transition-colors hover:border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--card)]"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d={d === -1 ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'}
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </Wrap>

      {/* Breaks the wrap deliberately so the rail runs to the edge. A card
          cropped by the viewport is the only drag affordance that works
          without being explained. */}
      <div
        ref={rail}
        className="oi-rail flex snap-x snap-proximity gap-[34px] overflow-x-auto px-5 pb-12 pt-11 sm:px-8"
      >
        {FINISHED_WORK.map((project, i) => (
          <article
            key={project.slug}
            data-card
            className="oi-card-tilt w-[clamp(300px,32vw,420px)] flex-none snap-start bg-[var(--card)] p-[18px] pb-[26px]"
            style={
              {
                boxShadow: '0 22px 50px -28px rgba(44,38,36,.5)',
                '--tilt': `${TILT[i % TILT.length]}deg`,
              } as React.CSSProperties
            }
          >
            {/* The whole card is one button. A card that is clickable
                everywhere except the exact pixels of a "view project" link is
                a card people click and nothing happens. */}
            <button
              type="button"
              onClick={() => setGate(project)}
              className="w-full cursor-pointer border-0 bg-transparent p-0 text-left"
            >
              <Image
                src={project.photo.src}
                alt={project.photo.alt}
                width={840}
                height={630}
                sizes="(max-width: 640px) 88vw, 420px"
                className="aspect-[4/3] w-full object-cover"
              />

              <p className="oi-label m-0 mb-2 mt-5" style={{ color: 'var(--sec-ink)' }}>
                {project.config} · {project.building}
              </p>
              <h3 className="oi-display m-0 mb-2 text-[28px]">{project.title}</h3>
              <p className="m-0 mb-5 text-[14.5px] leading-[1.55] text-[var(--ink2)]">
                {project.note}
              </p>

              <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-4 border-b border-[var(--line)] pb-5">
                <Meta label="Location" value={project.locality} />
                <Meta
                  label="Carpet area"
                  value={`${project.areaSqft.toLocaleString('en-IN')} sq ft`}
                />
                <Meta label="Finish band" value={project.band} sage />
                <Meta label="Final cost" value={project.cost} />
              </dl>

              <p className="m-0 mt-4 flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] text-[var(--ink2)]">{project.studio}</span>
                <span
                  className="oi-num text-[10px] uppercase tracking-[0.16em]"
                  style={{ color: 'var(--acc-ink)' }}
                >
                  View project →
                </span>
              </p>
            </button>
          </article>
        ))}
      </div>

      <Wrap>
        <p className="oi-label m-0 border-t border-[var(--line)] pt-4 text-right">
          Scroll over the rail to move it · {String(FINISHED_WORK.length).padStart(2, '0')} projects
        </p>
      </Wrap>

      {gate ? <Gate project={gate} onClose={() => setGate(null)} /> : null}
    </section>
  );
}

function Meta({ label, value, sage = false }: { label: string; value: string; sage?: boolean }) {
  return (
    <div>
      <dt className="oi-label m-0 mb-1.5">{label}</dt>
      <dd
        className="oi-num m-0 text-[13px]"
        style={sage ? { color: 'var(--sec-ink)' } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
