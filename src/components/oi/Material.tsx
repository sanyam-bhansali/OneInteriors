'use client';

/**
 * Specs you can tap, and the panel that answers.
 *
 * ## The problem this solves
 *
 * The comparison screen's instruction is "look at the materials before the
 * totals". For most readers that instruction is unactionable: `18mm BWP
 * carcass · laminate shutter · soft-close hinges` is not information to
 * somebody who does not already know what BWP is, it is decoration that looks
 * like information. Telling somebody to read evidence they cannot read is the
 * same failure as hiding it, with better manners.
 *
 * So every spec string in the product renders through `Spec`, which marks the
 * terms it recognises and makes each one a real button. One shared panel
 * answers, anchored at the foot of the viewport.
 *
 * ## Why one panel and not a popover per term
 *
 * There are twenty-three lines on a comparison and up to four studios, so a
 * popover per cell is ninety-odd popovers, every one of them a focus trap
 * waiting to happen. A single panel is one thing to open, one thing to close,
 * one place the eye learns to look — and it stays put while you carry on
 * reading the table behind it, which a modal would not allow.
 *
 * It is deliberately **not** a `<dialog>`: this is reference material you read
 * *while* comparing, not a decision you make before continuing. Trapping focus
 * would be actively wrong. Escape closes it, the close button is first in tab
 * order within it, and opening it does not move focus away from the table.
 */

import { useEffect } from 'react';
import { splitSpec, type Material } from '@/modules/materials/glossary';

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
            className="cursor-pointer border-0 bg-transparent p-0 text-inherit underline decoration-dotted decoration-from-font underline-offset-[3px] hover:decoration-solid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acc)]"
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
 * The body of the explanation. Separated from the panel chrome so the same
 * three paragraphs can appear inline — after a quiz answer, say — without the
 * close button and the fixed positioning coming with them.
 */
export function MaterialCard({ material: m }: { material: Material }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="oi-display m-0 text-[19px]">{m.name}</h3>
        {m.standard ? (
          <span className="oi-num text-[11px] uppercase tracking-[0.14em] text-[var(--ink2)]">
            {m.standard}
          </span>
        ) : null}
      </div>

      <p className="m-0 mb-4 max-w-[64ch] text-[14.5px] leading-[1.6] text-[var(--ink)]">{m.what}</p>

      <div className="mb-4">
        <p className="oi-label m-0 mb-1.5">Where it matters</p>
        <p className="m-0 max-w-[64ch] text-[14px] leading-[1.6] text-[var(--ink2)]">{m.matters}</p>
      </div>

      {/* The load-bearing half. A glossary that only defines terms teaches
          vocabulary; this is the part that teaches somebody to read a
          quotation. When the honest answer is that the downgrade costs
          nothing, the entry says so — see the 18mm entry. */}
      <div className="border-t border-[var(--line)] pt-4">
        <p className="oi-label m-0 mb-1.5">
          {m.cheaperAlt ? `Cheaper instead — ${m.cheaperAlt}` : 'If you see it downgraded'}
        </p>
        {m.cheaperSaves ? (
          <p className="oi-num m-0 mb-2 text-[13px]" style={{ color: 'var(--acc-ink)' }}>
            Saves {m.cheaperSaves}
          </p>
        ) : null}
        <p className="m-0 max-w-[64ch] text-[14px] leading-[1.6] text-[var(--ink)]">
          {m.cheaperCosts}
        </p>
      </div>
    </div>
  );
}

/**
 * The panel at the foot of the screen.
 *
 * Capped at 60vh and scrollable, so on a phone it never swallows the table it
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
      className="oi-swap fixed inset-x-0 bottom-0 z-30 max-h-[60vh] overflow-y-auto border-t border-[var(--ink)] bg-[var(--card)]"
      style={{ boxShadow: '0 -24px 50px -34px rgba(44,38,36,.5)' }}
    >
      <div className="mx-auto w-full max-w-[72rem] px-[clamp(16px,4vw,40px)] py-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="oi-eyebrow m-0 mb-3">In plain words</p>
            <MaterialCard material={m} />
          </div>

          {/* First in tab order inside the panel, and 44px, per 2.5.5. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the explanation"
            className="-mr-2 -mt-2 flex h-11 w-11 flex-none cursor-pointer items-center justify-center border-0 bg-transparent text-[20px] leading-none text-[var(--ink2)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--acc)]"
          >
            ✕
          </button>
        </div>
      </div>
    </aside>
  );
}
