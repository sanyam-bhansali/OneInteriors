'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { submitForReviewAction, type StepState } from './actions';

const INITIAL: StepState = { status: 'idle' };

/** One row of the final check: a step, whether it passes, and what is short. */
export interface ReviewSection {
  step: string;
  label: string;
  done: boolean;
  missing: string[];
}

export function ReviewPanel({
  alreadySubmitted,
  sections,
}: {
  alreadySubmitted: boolean;
  sections: ReviewSection[];
}) {
  /**
   * Derived here rather than passed in, so there is exactly one definition of
   * "ready" and it is the same data the rows are drawn from. A separate
   * `ready` prop could disagree with the ticks beside it — and of the two, the
   * button is the one that would be believed.
   */
  const ready = sections.every((s) => s.done);
  const [state, action, pending] = useActionState(submitForReviewAction, INITIAL);

  if (alreadySubmitted || state.status === 'saved') {
    return (
      <div className="rounded-[14px] border border-[var(--color-ontrack)] bg-[var(--color-ontrack-soft)] p-7">
        <h2 className="h2 mb-3">It is with us.</h2>
        <p className="m-0 mb-3 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
          We will call you within a week. Between now and then we check company records and GST
          filing history, call two past clients, and visit two completed sites.
        </p>
        <p className="m-0 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          You can keep editing anything — nothing is locked. And you will see your finished profile
          and approve it before a single customer does.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="m-0 mb-4 max-w-[62ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
          When you send this to us, four things happen — none of them make you visible to
          customers yet:
        </p>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          <Step n="01" body="We check your registration against the public GST and company records." />
          <Step n="02" body="We call two of your past clients. We will ask you who, and we will tell you what we ask them." />
          <Step n="03" body="We visit two completed sites. In person, unannounced only if you agree to that." />
          <Step n="04" body="You see the finished profile and approve every word of it. Then you go live." />
        </ol>
      </div>

      <div className="rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-3)] p-6">
        <p className="label m-0 mb-2">What we will publish about you later</p>
        <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          Once you have delivered projects through us, your profile carries the average number of
          days past your own committed date, and any dispute upheld against you. That is the deal,
          and it is worth saying plainly before you commit rather than after. It cuts both ways —
          it is also the reason a customer believes the good numbers.
        </p>
      </div>

      {/**
       * The final check, re-run from the data at render rather than trusted
       * from earlier in the flow.
       *
       * ## Why this is a table of steps and not a sentence
       *
       * It used to be one line — "Still to finish: a description, two more
       * projects, a GSTIN." Three sentences from three different steps, run
       * together with commas, and nothing saying which step to open for which
       * phrase. A studio read it, guessed, and opened the wrong step.
       *
       * So each step gets its own row, carrying only its own shortfall and its
       * own way back. The passing rows are shown too, not hidden: a list that
       * only shows failures cannot be distinguished from a list that has not
       * loaded, and seeing four ticks is most of the reassurance this screen
       * is for.
       *
       * The sentences are `assessSteps`' own, the same ones the footer and the
       * dashboard use — this screen never rephrases a rule.
       */}
      <section aria-labelledby="final-check">
        <h2
          id="final-check"
          className="label m-0 mb-3 text-[var(--color-ink-3)]"
        >
          {ready ? 'Everything checks out' : 'Before you send'}
        </h2>

        <ul className="m-0 flex list-none flex-col gap-px overflow-hidden rounded-[12px] border border-[var(--color-rule)] p-0">
          {sections.map((section) => (
            <li
              key={section.step}
              className={`flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4 ${
                section.done ? 'bg-[var(--color-paper)]' : 'bg-[var(--color-brass-soft)]'
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full ${
                  section.done
                    ? 'bg-[var(--color-ontrack)] text-white'
                    : 'border border-[var(--color-brass)] text-[var(--color-brass)]'
                }`}
              >
                {section.done ? (
                  <>
                    <span className="sr-only">Complete:</span>
                    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3">
                      <path
                        d="M3.5 8.5 L6.5 11.5 L12.5 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                ) : (
                  <>
                    <span className="sr-only">Not finished:</span>
                    <span aria-hidden="true" className="text-[13px] font-bold leading-none">
                      !
                    </span>
                  </>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-[var(--color-ink)]">
                  {section.label}
                </span>
                {section.done ? null : (
                  <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0">
                    {section.missing.map((m) => (
                      <li
                        key={m}
                        className="text-[14px] leading-relaxed text-[var(--color-ink-2)]"
                      >
                        {m}
                      </li>
                    ))}
                  </ul>
                )}
              </span>

              {/* Only on the rows that need it. An Edit link beside a finished
                  step reads as an instruction to go and change something. */}
              {section.done ? null : (
                <Link
                  href={`/studio/onboarding/${section.step}`}
                  className="flex-none rounded-full border border-[var(--color-ink)]/20 px-4 py-1.5 text-[13.5px] font-medium text-[var(--color-ink)] no-underline transition-colors hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)]"
                >
                  Finish this
                  <span className="sr-only"> — {section.label}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <form action={action} className="border-t border-[var(--color-rule)] pt-6">
        {state.status === 'error' ? (
          <p role="alert" className="m-0 mb-3 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-2.5 text-[14.5px] text-[var(--color-atrisk)]">
            {state.errors?.form}
          </p>
        ) : null}
        {/* Absent rather than greyed out, the same rule the step footer
            follows: the list above is the control, and a dead button sitting
            under it invites clicking to find out why. */}
        {ready ? (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-petrol)] px-7 py-3.5 text-[15px] font-medium text-[var(--color-paper)] transition-colors hover:bg-[var(--color-petrol-deep)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? 'Sending…' : 'Send for verification'}
          </button>
        ) : (
          <p className="m-0 text-[14.5px] text-[var(--color-ink-3)]">
            Finish the {sections.filter((s) => !s.done).length === 1 ? 'step' : 'steps'} marked
            above and this becomes <span className="text-[var(--color-ink-2)]">Send for verification</span>.
          </p>
        )}
      </form>
    </div>
  );
}

function Step({ n, body }: { n: string; body: string }) {
  return (
    <li className="grid grid-cols-[30px_minmax(0,1fr)] gap-3">
      <span className="tabular font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[var(--color-petrol)]">
        {n}
      </span>
      <span className="text-[15px] leading-relaxed text-[var(--color-ink-2)]">{body}</span>
    </li>
  );
}
