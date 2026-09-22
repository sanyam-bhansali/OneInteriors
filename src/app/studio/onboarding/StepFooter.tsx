import Link from 'next/link';
import { STEP_LABELS, type OnboardingStep, type StepStatus } from '@/modules/studio/onboarding';

/**
 * Back, Continue, and the reason Continue is not available yet.
 *
 * ## Continue is absent, not disabled, until the step is done
 *
 * A greyed-out button with no explanation is the single most common way an
 * onboarding flow loses somebody: they have filled in what they can see,
 * the button will not light, and there is nothing on screen saying why.
 *
 * So when the step is incomplete, the button is replaced by the list of what
 * is still missing — in the studio's own words, straight out of
 * `assessSteps`. The list IS the control: finish those and the button
 * appears.
 *
 * ## Why the missing list is not invented here
 *
 * `assessSteps` already produces it, because the same sentences have to
 * appear on the dashboard, on this footer and in the Review summary. Three
 * copies of "at least three projects" that drift apart is how a studio ends
 * up being told two different things about the same rule.
 *
 * ## Saving is separate from continuing
 *
 * Each form saves on its own submit. This footer never saves — it only moves.
 * That split is deliberate: a studio that types something and leaves without
 * pressing Continue has still had their work stored, and a Continue that
 * silently saved would make the back button a way to lose it.
 */
export function StepFooter({
  status,
  previous,
  next,
}: {
  status: StepStatus;
  previous: OnboardingStep | undefined;
  next: OnboardingStep | undefined;
}) {
  return (
    <div className="mt-12 border-t border-[var(--color-rule)] pt-6">
      {!status.done && status.missing.length > 0 ? (
        <div className="mb-5 rounded-[10px] border border-[var(--color-brass)]/35 bg-[var(--color-brass-soft)] px-4 py-3">
          <p className="m-0 mb-1 text-[13.5px] font-semibold text-[var(--color-ink)]">
            {status.missing.length === 1
              ? 'One thing left on this step'
              : `${status.missing.length} things left on this step`}
          </p>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {status.missing.map((m) => (
              <li
                key={m}
                className="flex items-start gap-2 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]"
              >
                <span aria-hidden="true" className="mt-[7px] h-1 w-1 flex-none rounded-full bg-[var(--color-ink-3)]" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <nav className="flex flex-wrap items-center justify-between gap-4">
        {previous ? (
          <Link
            href={`/studio/onboarding/${previous}`}
            className="text-[14.5px] text-[var(--color-ink-3)] no-underline hover:text-[var(--color-ink)]"
          >
            ← {STEP_LABELS[previous]}
          </Link>
        ) : (
          <span />
        )}

        {next && status.done ? (
          <Link
            href={`/studio/onboarding/${next}`}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-petrol)] px-6 py-2.5 text-[14.5px] font-medium text-[var(--color-paper)] no-underline transition-colors hover:bg-[var(--color-petrol-deep)]"
          >
            Continue
            <span aria-hidden="true">→</span>
          </Link>
        ) : next ? (
          <span className="text-[13.5px] text-[var(--color-ink-3)]">
            Finish the above to continue to {STEP_LABELS[next]}
          </span>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
