'use client';

/**
 * Specs you can tap, and the card that answers.
 *
 * ## What changed, and why
 *
 * This panel used to answer a tapped material with three paragraphs. It was
 * accurate and nobody would have read it. Somebody choosing a kitchen is
 * excited, a bit nervous and usually on a phone — an essay at that moment is
 * not thoroughness, it is an obstacle, and an explanation nobody opens teaches
 * exactly as much as no explanation at all.
 *
 * So the answer is now **a card**: a drawing that shows the difference, one
 * line saying what the thing is, the two sides set against each other in five
 * words apiece, and the money as a single figure. About four seconds. The full
 * paragraph is still there behind "the long version", for the one reader in
 * twenty who wants it.
 *
 * ## Why one panel and not a popover per term
 *
 * There are twenty-three lines on a comparison and up to four studios, so a
 * popover per cell is ninety-odd popovers, every one a focus trap waiting to
 * happen. One panel is one thing to open, one thing to close, one place the
 * eye learns to look — and it stays put while you carry on reading the table
 * behind it.
 *
 * It is deliberately **not** a `<dialog>`: this is reference you read *while*
 * comparing, not a decision you make before continuing, so trapping focus
 * would be actively wrong. Escape closes it, and opening it does not move
 * focus away from the table.
 */

import { useEffect, useState } from 'react';
import { splitSpec, type Material } from '@/modules/materials/glossary';
import { MaterialArt } from './MaterialArt';

/**
 * A spec string with its known terms marked.
 *
 * Marked with a dotted underline rather than a colour, because terracotta is
 * reserved for the one high-intent action per screen and sage means verified.
 * A third colour meaning "tappable" would break both rules at once.
 */
export function Spec({
  text,
  onPick,
  className = '',
}: {
  text: string;
  onPick: (m: Material) => void;
  className?: string;
}) {
  const parts = splitSpec(text);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.kind === 'text' ? (
          <span key={i}>{part.text}</span>
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => onPick(part.material)}
            title={`What ${part.material.name} means`}
            className="cursor-pointer border-0 bg-transparent p-0 text-inherit underline decoration-dotted decoration-from-font underline-offset-[3px] hover:decoration-solid"
            style={{ textDecorationColor: 'var(--ink2)' }}
          >
            {part.text}
          </button>
        ),
      )}
    </span>
  );
}

/**
 * The two sides, set against each other.
 *
 * This pair is the whole lesson. "Survives standing water" against "Survives
 * steam only" does more work than the paragraph it replaced, and it does it
 * without anybody deciding to concentrate.
 */
function Versus({ good, bad }: { good: string; bad: string }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)]">
      <p
        className="m-0 bg-[var(--card)] px-3.5 py-3 text-[13.5px] leading-snug"
        style={{ boxShadow: 'inset 3px 0 0 var(--sec)' }}
      >
        {good}
      </p>
      <p
        className="m-0 bg-[var(--card)] px-3.5 py-3 text-[13.5px] leading-snug text-[var(--ink2)]"
        style={{ boxShadow: 'inset 3px 0 0 var(--line)' }}
      >
        {bad}
      </p>
    </div>
  );
}

/**
 * The card. Drawing, one line, the two sides, the money.
 *
 * `compact` drops the disclosure — used inside the quote build, where the
 * cards are arriving on a timer and nothing should invite a click.
 */
export function MaterialCard({
  material: m,
  compact = false,
}: {
  material: Material;
  compact?: boolean;
}) {
  const [long, setLong] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-start gap-5">
        <div className="w-[104px] flex-none sm:w-[124px]">
          <MaterialArt art={m.art} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="oi-display m-0 text-[19px]">{m.name}</h3>
            {m.standard ? (
              <span className="oi-num text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink2)]">
                {m.standard}
              </span>
            ) : null}
          </div>
          <p className="m-0 mt-1.5 max-w-[42ch] text-[14px] leading-snug text-[var(--ink2)]">
            {m.tagline}
          </p>
          <p className="m-0 mt-3 flex items-baseline gap-2">
            <span
              className="oi-num text-[20px] leading-none"
              style={{ color: m.moneyIs === 'saves' ? 'var(--acc-ink)' : 'var(--ink2)' }}
            >
              {m.money}
            </span>
            <span className="oi-label m-0">
              {m.moneyIs === 'saves' ? 'to skip it' : 'either way'}
            </span>
          </p>
        </div>
      </div>

      <Versus good={m.good} bad={m.bad} />

      {!compact ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setLong((v) => !v)}
            aria-expanded={long}
            className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[var(--ink2)] underline hover:text-[var(--ink)]"
          >
            {long ? 'Close' : 'The long version'}
          </button>
          {long ? (
            <p className="oi-swap m-0 mt-2.5 max-w-[68ch] text-[13.5px] leading-[1.6] text-[var(--ink2)]">
              {m.detail}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The panel at the foot of the screen.
 *
 * Capped at 62vh and scrollable, so on a phone it never swallows the table it
 * is explaining. Escape closes it.
 */
export function MaterialPanel({
  material: m,
  onClose,
}: {
  material: Material | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!m) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [m, onClose]);

  if (!m) return null;

  return (
    <aside
      aria-label={`What ${m.name} means`}
      className="oi-rise-in fixed inset-x-0 bottom-0 z-30 max-h-[62vh] overflow-y-auto border-t border-[var(--ink)] bg-[var(--card)]"
      style={{ boxShadow: '0 -24px 50px -34px rgba(44,38,36,.5)' }}
    >
      <div className="mx-auto w-full max-w-[72rem] px-[clamp(16px,4vw,40px)] py-6">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <MaterialCard material={m} />
          </div>

          {/* First in tab order inside the panel, and 44px, per 2.5.5. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the explanation"
            className="-mr-2 -mt-2 flex h-11 w-11 flex-none cursor-pointer items-center justify-center border-0 bg-transparent text-[20px] leading-none text-[var(--ink2)] hover:text-[var(--ink)]"
          >
            ✕
          </button>
        </div>
      </div>
    </aside>
  );
}

/**
 * The term as a chip, for places where the spec is a list rather than a
 * sentence — the comparison table, where a paragraph per cell would be
 * unreadable at four columns wide.
 */
export function MaterialChip({
  material: m,
  onPick,
}: {
  material: Material;
  onPick: (m: Material) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(m)}
      title={m.tagline}
      className="inline-flex cursor-pointer items-center gap-1.5 border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-[11.5px] leading-none text-[var(--ink)] hover:border-[var(--ink2)]"
    >
      <span
        aria-hidden
        className="h-[7px] w-[7px] flex-none rounded-full"
        // Raw sage is 2.72:1 on Raw Silk; the chip sits on it.
        style={{ background: 'var(--sec-ink)' }}
      />
      {m.name}
    </button>
  );
}
