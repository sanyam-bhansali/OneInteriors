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

/**
 * The last step: what we do next, and what it buys them.
 *
 * ## Why the checklist stays at the top of a page about reassurance
 *
 * The redesign for this screen is all trust-building — four cards about
 * verification, three about what approval is worth. That is right, and it is
 * worth nothing to a studio who cannot submit and does not know why. So the
 * completion state comes first and it is specific: a row per step, that
 * step's own shortfall in `assessSteps`' own words, and a link back to it.
 *
 * ## The button is absent rather than disabled while anything is short
 *
 * Same rule the step footer follows. The list above is the control; a dead
 * button underneath it only invites a click to find out why.
 */
export function ReviewPanel({
  alreadySubmitted,
  sections,
}: {
  alreadySubmitted: boolean;
  sections: ReviewSection[];
}) {
  const [state, action, pending] = useActionState(submitForReviewAction, INITIAL);

  /* Derived here rather than passed in, so there is exactly one definition of
     "ready" and it is the same data the rows are drawn from. A separate prop
     could disagree with the ticks beside it — and of the two, the button is
     the one that would be believed. */
  const ready = sections.every((s) => s.done);
  const done = sections.filter((s) => s.done).length;

  if (alreadySubmitted || state.status === 'saved') {
    return <Submitted />;
  }

  return (
    <div className="flex flex-col gap-7">
      <Completion sections={sections} done={done} ready={ready} />

      <section>
        <h2 className="h3 m-0 mb-1">What happens next</h2>
        <p className="m-0 mb-4 max-w-[60ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          Four checks, in this order. None of them makes you visible to customers — the last word
          is yours.
        </p>
        <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
          <Next
            n="01"
            title="Registration"
            body="We check your GSTIN against the public GST record, and the company details against the registry."
            icon={<DocIcon />}
          />
          <Next
            n="02"
            title="Two reference calls"
            body="We call two of your past clients. We will ask you who, and tell you what we are going to ask them."
            icon={<PhoneIcon />}
          />
          <Next
            n="03"
            title="Two site visits"
            body="We stand in two finished projects. In person, and unannounced only if you agree to that."
            icon={<PinIcon />}
          />
          <Next
            n="04"
            title="You approve it"
            body="We assemble the profile and you read every word before a single customer does."
            icon={<CheckIcon />}
          />
        </ol>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Aside title="Usually under a week" icon={<ClockIcon />}>
          {/* The brief said 24–72 hours. That is not what the process above
              takes — two reference calls and two site visits cannot be
              scheduled inside three days — and a stated turnaround we miss is
              worse than a longer one we keep. */}
          Reference calls and site visits take as long as your clients and your sites are
          available. We tell you where it has got to rather than leaving you to wonder.
        </Aside>
        <Aside title="Not everyone is approved" icon={<PeopleIcon />}>
          If it is a no, we tell you why rather than going quiet. A curated roster only means
          anything if it can say no.
        </Aside>
      </div>

      <section className="rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-6 py-5">
        <h2 className="h3 m-0 mb-3">What being listed gets you</h2>
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-3">
          <Benefit title="Briefs, not enquiries">
            A homeowner who has answered nine questions and seen your quote before you hear from
            them.
          </Benefit>
          <Benefit title="Inside your range">
            Nothing under the floor you set. That filter is the whole point of asking for it.
          </Benefit>
          <Benefit title="Nobody pays to outrank you">
            Position in a customer&rsquo;s results comes from the match and nothing else. There is
            no boost to buy.
          </Benefit>
        </ul>
      </section>

      <section className="rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-3)] p-6">
        <p className="label m-0 mb-2">What we will publish about you later</p>
        <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          Once you have delivered projects through us, your profile carries the average number of
          days past your own committed date, and any dispute upheld against you. That is the deal,
          and it is worth saying plainly before you commit rather than after. It cuts both ways —
          it is also the reason a customer believes the good numbers.
        </p>
      </section>

      <form action={action} className="border-t border-[var(--color-rule)] pt-6">
        {state.status === 'error' ? (
          <p role="alert" className="m-0 mb-3 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-2.5 text-[14.5px] text-[var(--color-atrisk)]">
            {state.errors?.form}
          </p>
        ) : null}

        {ready ? (
          <>
            <button
              type="submit"
              disabled={pending}
              className="oi-save inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--color-petrol)] px-7 py-4 text-[15.5px] font-medium text-[var(--color-paper)] disabled:opacity-50"
            >
              {pending ? 'Sending…' : 'Send it for verification'}
              {pending ? null : <span aria-hidden="true">→</span>}
            </button>
            <p className="m-0 mt-2.5 text-center text-[13px] text-[var(--color-ink-3)]">
              You can keep editing everything after you send it. Nothing locks.
            </p>
          </>
        ) : (
          <p className="m-0 text-[14.5px] text-[var(--color-ink-3)]">
            Finish the {sections.filter((s) => !s.done).length === 1 ? 'step' : 'steps'} marked
            above and this becomes{' '}
            <span className="text-[var(--color-ink-2)]">Send it for verification</span>.
          </p>
        )}
      </form>
    </div>
  );
}

/**
 * The completion state, and the final validation in one object.
 *
 * The bar and the rows are the same data, so they cannot disagree — a page
 * reading "100%" beside an unfinished step is the specific failure
 * `percentComplete` is capped at 99 to avoid, and repeating the arithmetic
 * here would reintroduce it.
 */
function Completion({
  sections,
  done,
  ready,
}: {
  sections: ReviewSection[];
  done: number;
  ready: boolean;
}) {
  const percent = sections.length === 0 ? 0 : Math.round((done / sections.length) * 100);

  return (
    <section
      className={`rounded-[16px] border px-6 py-5 ${
        ready
          ? 'border-[var(--color-ontrack)]/30 bg-[var(--color-ontrack-soft)]'
          : 'border-[var(--color-rule)] bg-[var(--color-paper-2)]'
      }`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-full ${
              ready
                ? 'bg-[var(--color-ontrack)] text-white'
                : 'bg-[var(--color-paper-3)] text-[var(--color-ink-2)]'
            }`}
          >
            {ready ? <Tick /> : <span className="text-[13px] font-semibold">{done}</span>}
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[16px] font-semibold text-[var(--color-ink)]">
              {ready ? 'Your profile is complete' : 'Nearly there'}
            </p>
            <p className="m-0 mt-0.5 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
              {ready
                ? 'Everything we need is in. Read what happens next, then send it.'
                : `${sections.length - done} of ${sections.length} steps still need something.`}
            </p>
          </div>
        </div>

        <div className="min-w-[10rem] flex-1">
          <p className="m-0 mb-1.5 text-right font-[family-name:var(--font-mono)] text-[12px] tabular-nums text-[var(--color-ink-2)]">
            {percent}% complete
          </p>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[var(--color-rule)]"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completeness"
          >
            <div
              className="h-full rounded-full bg-[var(--color-ontrack)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Passing rows are shown as well as failing ones. A list that shows
          only failures cannot be told apart from a list that failed to load,
          and four ticks is most of the reassurance this screen is for. */}
      <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
        {sections.map((section) => (
          <li
            key={section.step}
            className={`flex flex-wrap items-start gap-x-3 gap-y-1.5 rounded-[11px] px-4 py-3 ${
              section.done ? 'bg-[var(--color-paper)]' : 'bg-[var(--color-brass-soft)]'
            }`}
          >
            <span
              className={`mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-full ${
                section.done
                  ? 'bg-[var(--color-ontrack)] text-white'
                  : 'border border-[var(--color-brass)] text-[var(--color-brass)]'
              }`}
            >
              {section.done ? (
                <>
                  <span className="sr-only">Complete:</span>
                  <Tick small />
                </>
              ) : (
                <>
                  <span className="sr-only">Not finished:</span>
                  <span aria-hidden="true" className="text-[11px] font-bold leading-none">
                    !
                  </span>
                </>
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-medium text-[var(--color-ink)]">
                {section.label}
              </span>
              {section.done ? null : (
                <ul className="m-0 mt-0.5 flex list-none flex-col gap-0.5 p-0">
                  {section.missing.map((m) => (
                    <li key={m} className="text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                      {m}
                    </li>
                  ))}
                </ul>
              )}
            </span>

            {/* Only on the rows that need it. An edit link beside a finished
                step reads as an instruction to go and change something. */}
            {section.done ? null : (
              <Link
                href={`/studio/onboarding/${section.step}`}
                className="flex-none text-[13px] font-medium text-[var(--color-petrol)] underline underline-offset-4"
              >
                Finish
                <span className="sr-only"> {section.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Submitted() {
  return (
    <div className="rounded-[16px] border border-[var(--color-ontrack)] bg-[var(--color-ontrack-soft)] p-8">
      <h2 className="h2 mb-3">It is with us.</h2>
      <p className="m-0 mb-3 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
        We check company records and GST filing history, call two past clients, and visit two
        completed sites. We will tell you where it has got to rather than leaving you to wonder.
      </p>
      <p className="m-0 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
        You can keep editing anything — nothing is locked. And you will see your finished profile
        and approve it before a single customer does.
      </p>
    </div>
  );
}

function Next({
  n,
  title,
  body,
  icon,
}: {
  n: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="rounded-[13px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-paper-3)] text-[var(--color-ink-2)]">
          {icon}
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--color-ink-3)]">
          {n}
        </span>
      </div>
      <p className="m-0 text-[15px] font-medium text-[var(--color-ink)]">{title}</p>
      <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">{body}</p>
    </li>
  );
}

function Aside({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[12px] bg-[var(--color-paper-2)] px-5 py-4">
      <span className="mt-0.5 flex-none text-[var(--color-ink-3)]">{icon}</span>
      <div className="min-w-0">
        <p className="m-0 text-[14.5px] font-medium text-[var(--color-ink)]">{title}</p>
        <p className="m-0 mt-0.5 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          {children}
        </p>
      </div>
    </div>
  );
}

function Benefit({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li>
      <p className="m-0 flex items-center gap-2 text-[14.5px] font-medium text-[var(--color-ink)]">
        <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-[var(--color-ontrack)] text-white">
          <Tick small />
        </span>
        {title}
      </p>
      <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">{children}</p>
    </li>
  );
}

function Tick({ small }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={small ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'}>
      <path
        d="M3.5 8.5 L6.5 11.5 L12.5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICON = {
  className: 'h-[17px] w-[17px]',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
} as const;

function DocIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...ICON} strokeLinejoin="round">
      <path d="M11.5 2.5H6.2a1.7 1.7 0 0 0-1.7 1.7v11.6a1.7 1.7 0 0 0 1.7 1.7h7.6a1.7 1.7 0 0 0 1.7-1.7V6.5l-4-4Z" />
      <path d="M11.5 2.5v4h4M7.4 11h5.2M7.4 13.8h3.4" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...ICON} strokeLinejoin="round">
      <path d="M6.3 3.2 8 3.6l.9 3-1.6 1.2a9.4 9.4 0 0 0 3.9 3.9l1.2-1.6 3 .9.4 1.7a1.5 1.5 0 0 1-1.6 1.8C9.1 14.1 5.9 10.9 4.5 4.8A1.5 1.5 0 0 1 6.3 3.2Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...ICON} strokeLinejoin="round">
      <path d="M10 17.5s5.5-5 5.5-9a5.5 5.5 0 1 0-11 0c0 4 5.5 9 5.5 9Z" />
      <circle cx="10" cy="8.3" r="2.1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...ICON} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.2" />
      <path d="M6.6 10.2 8.9 12.5 13.4 8" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...ICON} strokeLinecap="round">
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 6v4.3l2.7 1.6" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...ICON} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="7.4" r="2.6" />
      <path d="M3.3 15.6a4.8 4.8 0 0 1 9.4 0" />
      <path d="M13.4 5.2a2.6 2.6 0 0 1 .3 4.9M14.6 11.6a4.4 4.4 0 0 1 2.4 3.6" />
    </svg>
  );
}
