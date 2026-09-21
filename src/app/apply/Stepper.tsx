'use client';

/**
 * The progress rail: grey outline, solid dark, green tick.
 *
 * Three states, and the third is the point. A tick is a record of work
 * already finished, so it accumulates and gives somebody a reason not to
 * close the tab. Unlike a percentage bar it cannot lie, because it only
 * appears once a step is genuinely complete.
 *
 * ## The total is visible from step one
 *
 * Every circle is rendered from the start, including the ones not
 * reached. A stranger filling in a cold application assumes it is longer
 * than it is, and the only cure is showing them the end before they
 * start. A rail that reveals steps as you go is worse than no rail.
 *
 * ## Clickable backwards only
 *
 * A finished step is a link; the current one is not; a future one is
 * inert. Jumping ahead past validation would let somebody reach the
 * submit button without the required fields, and the server would reject
 * them with errors attached to fields they can no longer see.
 */
export function Stepper({
  steps,
  current,
  furthest,
  onGo,
}: {
  steps: { label: string }[];
  current: number;
  /** The highest step reached, so a completed step stays clickable. */
  furthest: number;
  onGo: (i: number) => void;
}) {
  /**
   * The bar underneath the circles.
   *
   * Steps done, out of total — so it moves in thirds and every jump is
   * earned by finishing something. A bar that creeps as you type is
   * guessing, and a guess that runs ahead of the work is the reason
   * progress bars are distrusted.
   */
  const pct = Math.round((furthest / steps.length) * 100);

  return (
    <nav aria-label="Application progress" className="mb-6">
      <div className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-2)]">
            Step {current + 1} of {steps.length}
          </span>
          <span className="tabular font-[family-name:var(--font-mono)] text-[11px] tracking-[0.1em] text-[var(--color-ink-2)]">
            {pct}%
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[var(--color-rule)]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Application progress"
        >
          <div
            className="h-full rounded-full bg-[var(--color-ontrack)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="m-0 flex list-none items-start justify-center gap-0 p-0">
        {steps.map((s, i) => {
          const done = i < furthest;
          const here = i === current;
          const reachable = i <= furthest && !here;

          return (
            <li key={s.label} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* Leading half-rail. Hidden on the first step rather than
                    conditionally rendered, so every item keeps the same
                    box and the circles stay evenly spaced. */}
                <span
                  aria-hidden="true"
                  className={`h-px flex-1 ${i === 0 ? 'invisible' : ''} ${
                    i <= furthest ? 'bg-[var(--color-ontrack)]' : 'bg-[var(--color-rule)]'
                  }`}
                />

                {reachable ? (
                  <button
                    type="button"
                    onClick={() => onGo(i)}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-bold transition-colors ${circle(done, here)}`}
                    aria-label={`Back to ${s.label}`}
                  >
                    {done ? <Tick /> : i + 1}
                  </button>
                ) : (
                  <span
                    aria-current={here ? 'step' : undefined}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-bold ${circle(done, here)}`}
                  >
                    {done ? <Tick /> : i + 1}
                  </span>
                )}

                <span
                  aria-hidden="true"
                  className={`h-px flex-1 ${i === steps.length - 1 ? 'invisible' : ''} ${
                    i < furthest ? 'bg-[var(--color-ontrack)]' : 'bg-[var(--color-rule)]'
                  }`}
                />
              </div>

              {/* The label is for screen readers only. At five steps the
                  visible ones wrapped to two lines on anything narrow and
                  cost more height than they were worth — and the heading
                  directly below already names the step you are on. */}
              <span className="sr-only">{s.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function circle(done: boolean, here: boolean): string {
  if (done) return 'bg-[var(--color-ontrack)] text-white';
  if (here) return 'bg-[var(--color-ink)] text-[var(--color-paper)]';
  return 'border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink-3)]';
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4">
      <path
        d="M3.5 8.5 L6.5 11.5 L12.5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
