import Link from 'next/link';
import {
  ONBOARDING_STEPS,
  STEP_LABELS,
  gateFor,
  percentComplete,
  type OnboardingStep,
  type StepStatus,
} from '@/modules/studio/onboarding';

/**
 * Where you are in the five steps, and what is still shut.
 *
 * ## A locked step is not a link
 *
 * It renders as a `<span>` with no href, not as a disabled `<a>`. An anchor
 * with `aria-disabled` is still focusable, still in the tab order, and still
 * followable by middle-click — so "locked" would be a suggestion. The only
 * way to make a link not work is to not make it a link.
 *
 * ## The bar counts steps, not fields
 *
 * A bar that creeps as you type is guessing, and a guess that runs ahead of
 * the work is why progress bars are distrusted. Four of five is 80%, and it
 * moves when a step is genuinely finished.
 *
 * ## Why every state is written as well as drawn
 *
 * The tick, the ring and the padlock are all shape and colour. A screen
 * reader gets "Completed", "You are here" and "Locked" as text, because a
 * nav where the only difference between reachable and not is a glyph is a
 * nav somebody will keep trying to click.
 */
export function StepRail({
  steps,
  current,
}: {
  steps: StepStatus[];
  current: OnboardingStep;
}) {
  const percent = percentComplete(steps);
  const index = ONBOARDING_STEPS.indexOf(current);

  return (
    <div>
      <Link
        href="/studio"
        className="label mb-6 inline-block text-[var(--color-ink-3)] no-underline hover:text-[var(--color-ink)]"
      >
        ← All steps
      </Link>

      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="label m-0">
            Step {index + 1} of {ONBOARDING_STEPS.length}
          </span>
          <span className="label m-0 tabular-nums">{percent}% complete</span>
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-[var(--color-rule)]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile completeness"
        >
          <div
            className="h-full rounded-full bg-[var(--color-petrol)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
        {steps.map((status, i) => {
          const gate = gateFor(steps, status.step);
          const here = status.step === current;
          const label = STEP_LABELS[status.step];

          const row = (
            <span className="flex items-start gap-3 py-2">
              <Marker n={i + 1} gate={gate} here={here} />
              <span className="min-w-0">
                <span
                  className={`block text-[14.5px] leading-snug ${
                    here
                      ? 'font-semibold text-[var(--color-ink)]'
                      : gate === 'locked'
                        ? 'text-[var(--color-ink-3)]'
                        : 'text-[var(--color-ink-2)]'
                  }`}
                >
                  {label}
                </span>
                <span className="block text-[12.5px] leading-snug text-[var(--color-ink-3)]">
                  {gate === 'done'
                    ? 'Completed'
                    : here
                      ? 'You are here'
                      : gate === 'locked'
                        ? 'Finish the step above first'
                        : 'Not started'}
                </span>
              </span>
            </span>
          );

          return (
            <li key={status.step}>
              {gate === 'locked' || here ? (
                /* Not an anchor at all. See the note at the top — a disabled
                   link is still a link. */
                <span
                  aria-current={here ? 'step' : undefined}
                  className={`block rounded-[10px] px-2.5 ${
                    here ? 'bg-[var(--color-paper-2)]' : ''
                  }`}
                >
                  {row}
                </span>
              ) : (
                <Link
                  href={`/studio/onboarding/${status.step}`}
                  className="block rounded-[10px] px-2.5 no-underline transition-colors hover:bg-[var(--color-paper-2)]"
                >
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Marker({ n, gate, here }: { n: number; gate: string; here: boolean }) {
  const base =
    'mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] font-semibold';

  if (gate === 'done') {
    return (
      <span className={`${base} bg-[var(--color-ontrack)] text-white`}>
        <span className="sr-only">Completed:</span>
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
          <path
            d="M3.5 8.5 L6.5 11.5 L12.5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (gate === 'locked') {
    return (
      <span className={`${base} border border-[var(--color-rule)] text-[var(--color-ink-3)]`}>
        <span className="sr-only">Locked:</span>
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3" fill="currentColor">
          <path d="M8 1.5a3 3 0 0 0-3 3V6H4.4A.9.9 0 0 0 3.5 7v6a.9.9 0 0 0 .9.9h7.2a.9.9 0 0 0 .9-.9V7a.9.9 0 0 0-.9-1H11V4.5a3 3 0 0 0-3-3Zm1.6 4.5H6.4V4.5a1.6 1.6 0 0 1 3.2 0V6Z" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={`${base} ${
        here
          ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
          : 'border border-[var(--color-rule)] text-[var(--color-ink-3)]'
      }`}
    >
      {here ? <span className="sr-only">You are here:</span> : null}
      {n}
    </span>
  );
}
