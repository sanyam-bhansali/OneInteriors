'use client';

import Link from 'next/link';
import { Clock, Users } from 'lucide-react';
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
            n={1}
            title="Registration"
            body="We check your GSTIN against the public GST record, and the company details against the registry."
          />
          <Next
            n={2}
            title="Two reference calls"
            body="We call two of your past clients. We will ask you who, and tell you what we are going to ask them."
          />
          <Next
            n={3}
            title="Two site visits"
            body="We stand in two finished projects. In person, and unannounced only if you agree to that."
          />
          <Next
            n={4}
            title="You approve it"
            body="We assemble the profile and you read every word before a single customer does."
          />
        </ol>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Aside title="Usually under a week" icon={<Clock {...ICON} />}>
          {/* The brief said 24–72 hours. That is not what the process above
              takes — two reference calls and two site visits cannot be
              scheduled inside three days — and a stated turnaround we miss is
              worse than a longer one we keep. */}
          Reference calls and site visits take as long as your clients and your sites are
          available. We tell you where it has got to rather than leaving you to wonder.
        </Aside>
        <Aside title="Not everyone is approved" icon={<Users {...ICON} />}>
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

/**
 * Where the application has got to, once it has been sent.
 *
 * ## Why a tracker rather than a sentence
 *
 * "We will be in touch within a week" is true and answers nothing a studio
 * actually wants to know, which is *where has it got to*. A week of silence
 * against a sentence reads as having been forgotten; a week of silence
 * against a visible stage reads as a stage taking a week.
 *
 * ## The stages are honest about what we do not know
 *
 * Only the first is marked done, because only the first is something we can
 * observe from here — their side is finished. Everything after it happens in
 * a calendar and on phone calls, and a tracker that lit "Reference calls" up
 * green on a timer would be inventing progress. The rest are shown as what
 * is coming, not as what is happening.
 *
 * When ops gains a screen that records which check has been done, this reads
 * from that. Until then it says less rather than guessing.
 */
function Tracker() {
  const stages = [
    {
      title: 'Sent',
      body: 'Your side is complete. Nothing further is needed from you right now.',
      done: true,
    },
    { title: 'Registration checked', body: 'Against the public GST and company records.' },
    { title: 'Two clients called', body: 'We ask you who, and tell you what we will ask them.' },
    { title: 'Two sites visited', body: 'In person, and only unannounced if you agree to that.' },
    { title: 'You approve the profile', body: 'Every word of it, before a customer sees any.' },
  ];

  return (
    <ol className="m-0 mt-6 flex list-none flex-col p-0">
      {stages.map((stage, i) => (
        <li key={stage.title} className="relative flex gap-3.5 pb-5 last:pb-0">
          {/* The rail, drawn behind the markers and stopped before the last
              one so it does not trail off the bottom of the list. */}
          {i < stages.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute left-[10px] top-5 h-full w-px bg-[var(--color-rule)]"
            />
          ) : null}

          <span
            className={`relative z-10 mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full ${
              stage.done
                ? 'bg-[var(--color-ontrack)] text-white'
                : 'border border-[var(--color-rule)] bg-[var(--color-paper)]'
            }`}
          >
            {stage.done ? (
              <>
                <span className="sr-only">Done:</span>
                <Tick small />
              </>
            ) : (
              <span className="sr-only">To come:</span>
            )}
          </span>

          <span className="min-w-0">
            <span
              className={`block text-[14px] font-medium ${
                stage.done ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-2)]'
              }`}
            >
              {stage.title}
            </span>
            <span className="block text-[12.5px] leading-relaxed text-[var(--color-ink-3)]">
              {stage.body}
            </span>
          </span>
        </li>
      ))}
    </ol>
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

      {/**
       * The way out of this screen.
       *
       * Submitting opens the practice software — see `modules/studio/standing.ts`
       * — but this page was the last thing a studio saw and said nothing about
       * it, so the week of verification read as a week of being parked. The
       * navigation carries them too; this is the one that is in front of them
       * at the moment it becomes true.
       */}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--color-ontrack)]/25 pt-5">
        <Link
          href="/studio"
          className="inline-flex items-center gap-2 rounded-[12px] bg-[var(--color-petrol)] px-6 py-3 text-[15px] font-medium text-[var(--color-paper)]"
        >
          Open your software
          <span aria-hidden="true">→</span>
        </Link>
        <p className="m-0 max-w-[42ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          Your clients, your quotations and your rates are open now and are yours whatever we
          decide. Briefs from us start when you are on the roster.
        </p>
      </div>

      <Tracker />
    </div>
  );
}

/**
 * One of the four checks.
 *
 * The number and nothing else, in a tinted disc.
 *
 * An icon went in here first and came out again: four line icons across four
 * cards is four shapes to decode where the only thing that matters is the
 * order they happen in. Icons earn their place where they label a CHOICE —
 * upload or type — not where they decorate a sequence.
 *
 * Mono for the number, like every other counter on this surface.
 */
function Next({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-[13px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-5 py-4">
      <span className="mb-2.5 grid h-8 w-8 place-items-center rounded-full bg-[var(--color-petrol-soft)] font-[family-name:var(--font-mono)] text-[13px] font-medium tabular-nums text-[var(--color-petrol)]">
        {n}
      </span>
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

/**
 * The house icon size on this surface.
 *
 * 18px at stroke 2 with round caps — lucide's own geometry rather than the
 * 1.5 these were drawn at, which reads as precise and a little cold. The
 * mockup this was matched to is deliberately rounder, and at this size a
 * thinner stroke disappears against the body copy beside it.
 */
const ICON = { size: 18, strokeWidth: 2, absoluteStrokeWidth: true } as const;






