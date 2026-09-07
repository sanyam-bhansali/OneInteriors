/**
 * The escrow mechanic, drawn.
 *
 * This is the single most important idea on the site and it was previously
 * three paragraphs of prose. A diagram earns its place here because the thing
 * being explained is a *sequence with a gate in it* — money sits, evidence
 * arrives, the customer opens the gate, money moves. Prose makes that abstract;
 * a track makes it obvious.
 *
 * Values are a real split of a ₹8,50,000 contract using DEFAULT_MILESTONES,
 * computed through splitAcross so the parts genuinely sum to the whole.
 */

import { DEFAULT_MILESTONES, splitAcross, lakhsToPaise, formatINRCompact, formatINR } from '@/lib/money';

const CONTRACT = lakhsToPaise(8.5);

export function MilestoneTrack({ className = '' }: { className?: string }) {
  const amounts = splitAcross(
    CONTRACT,
    DEFAULT_MILESTONES.map((m) => m.weight),
  );

  // A plausible mid-project state: two approved, one awaiting the customer.
  const states = ['approved', 'approved', 'awaiting', 'pending', 'pending'] as const;

  return (
    <div className={className}>
      <ol className="m-0 flex list-none flex-col gap-0 p-0">
        {DEFAULT_MILESTONES.map((m, i) => {
          const state = states[i];
          const isLast = i === DEFAULT_MILESTONES.length - 1;
          return (
            <li key={m.title} className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-4">
              {/* Rail */}
              <div className="relative flex flex-col items-center">
                <Marker state={state} />
                {!isLast ? (
                  <span
                    className={`w-[2px] flex-1 ${
                      state === 'approved' ? 'bg-[var(--color-ontrack)]' : 'bg-[var(--color-rule)]'
                    }`}
                  />
                ) : null}
              </div>

              {/* Row */}
              <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
                <div className="min-w-0">
                  <p className="m-0 text-[14.5px] leading-snug text-[var(--color-ink)]">{m.title}</p>
                  <p className="m-0 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                    {state === 'approved'
                      ? 'Approved · released'
                      : state === 'awaiting'
                        ? 'Photos uploaded · your approval'
                        : 'Held in escrow'}
                  </p>
                </div>
                <span
                  className={`tabular shrink-0 font-[family-name:var(--font-mono)] text-[13px] ${
                    state === 'approved' ? 'text-[var(--color-ontrack)]' : 'text-[var(--color-ink-2)]'
                  }`}
                >
                  {formatINRCompact(amounts[i])}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-[var(--color-ink)] pt-3">
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
          Contract value
        </span>
        <span className="tabular font-[family-name:var(--font-mono)] text-[14px] text-[var(--color-ink)]">
          {formatINR(CONTRACT)}
        </span>
      </div>
    </div>
  );
}

/** State is carried by shape as well as colour. */
function Marker({ state }: { state: 'approved' | 'awaiting' | 'pending' }) {
  if (state === 'approved') {
    return (
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--color-ontrack)] text-[11px] leading-none text-[var(--color-paper)]">
        <span aria-hidden="true">✓</span>
        <span className="sr-only">Approved and released</span>
      </span>
    );
  }
  if (state === 'awaiting') {
    return (
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-brass)] bg-[var(--color-brass-soft)] text-[11px] leading-none text-[var(--color-brass)]">
        <span aria-hidden="true">◍</span>
        <span className="sr-only">Awaiting your approval</span>
      </span>
    );
  }
  return (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[var(--color-rule)] bg-transparent">
      <span className="sr-only">Held in escrow</span>
    </span>
  );
}
