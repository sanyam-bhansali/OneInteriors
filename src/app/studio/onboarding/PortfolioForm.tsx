'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { formatINRCompact } from '@/lib/money';
import { removeProjectAction, declarePortfolioShortfallAction, type StepState } from './actions';
import { SaveBar } from './fields';
import { ProjectModal } from './ProjectModal';
import { Image as ImageIcon } from 'lucide-react';
import { PANEL_ICON } from './icon-sizes';

const INITIAL: StepState = { status: 'idle' };

export interface ProjectRow {
  id: string;
  title: string;
  locality: string | null;
  styleTags: string[];
  valuePaise: number | null;
  completedOn: string | null;
  isRender: boolean;
  images: string[];
}

/**
 * The portfolio step, as a portfolio rather than a form.
 *
 * ## Two states, and the empty one is the important one
 *
 * This page used to open on sixteen controls whether or not the studio had
 * added anything, so the first thing a practice saw on the step about their
 * work was a wall of inputs. Now there is nothing to read until there is
 * something to show: the empty state is a sentence and one button, and the
 * form it opens is a modal that closes again.
 *
 * ## The count is the whole progress indicator
 *
 * "2 of 3 added" and a row of three marks. Three is the bar for being listed
 * and it is stated everywhere it applies, because a studio who finds out
 * about it on the fourth screen reads it as a bait-and-switch — which is the
 * reason `portfolioShortfallNote` exists at all.
 */
export function PortfolioForm({
  projects,
  minimum,
  shortfallNote,
  uploadEnabled,
  continueHref,
}: {
  projects: ProjectRow[];
  minimum: number;
  /** What they have told us they have instead, if they have told us. */
  shortfallNote: string | null;
  uploadEnabled: boolean;
  /**
   * Where "Save and continue" goes, when there is anywhere to continue to.
   *
   * This component is also the whole of `/studio/work`, which is a studio
   * managing their portfolio long after onboarding. A button there offering
   * to move them on to Your rates would be moving them through a flow they
   * finished months ago, so the step passes this and the standalone page
   * does not.
   */
  continueHref?: string;
}) {
  const [adding, setAdding] = useState(false);
  const short = projects.length < minimum;

  return (
    <div className="flex flex-col gap-6">
      {projects.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} minimum={minimum} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="h3 m-0">
                {projects.length === 1
                  ? 'One project so far'
                  : `${projects.length} projects so far`}
              </p>
              <p className="m-0 mt-0.5 text-[14px] text-[var(--color-ink-2)]">
                {short
                  ? `${minimum - projects.length} more and this step is done.`
                  : 'Enough to be listed. Add more if you have them — a customer reads all of it.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="oi-save inline-flex flex-none items-center gap-2 rounded-[11px] bg-[var(--color-petrol)] px-5 py-2.5 text-[14.5px] font-medium text-[var(--color-paper)]"
            >
              <span aria-hidden="true">+</span> Add a project
            </button>
          </div>

          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}

            {/* The slot for the next one, sized like the cards beside it so
                the grid does not end on a ragged edge while they are still
                short of three. */}
            <li>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="oi-addcard flex h-full min-h-[13rem] w-full flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[var(--color-rule)] px-5 py-6 text-center"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-petrol)] text-[18px] leading-none text-white">
                  +
                </span>
                <span className="text-[14.5px] font-medium text-[var(--color-ink)]">
                  Add another
                </span>
                <span className="text-[13px] text-[var(--color-ink-3)]">
                  {short ? `${minimum - projects.length} to go` : 'Show more of your work'}
                </span>
              </button>
            </li>
          </ul>

          <Tally count={projects.length} minimum={minimum} />
        </>
      )}

      {/* Only when the arithmetic says they are short. Offering an exemption
          to somebody who does not need one invites them to take it. */}
      {short && projects.length > 0 ? <ShortfallForm note={shortfallNote} /> : null}

      {/* Nothing to continue past on an empty step — the empty state is one
          button and the only sensible next action is pressing it. */}
      {continueHref && projects.length > 0 ? (
        <Continue
          href={continueHref}
          ready={projects.length >= minimum || Boolean(shortfallNote)}
          remaining={minimum - projects.length}
        />
      ) : null}

      <ProjectModal
        open={adding}
        onClose={() => setAdding(false)}
        uploadEnabled={uploadEnabled}
      />
    </div>
  );
}

/**
 * The way out of this step.
 *
 * ## Why this exists when the footer already has a Continue
 *
 * Because on this step it was the only one, and it sits below a grid of
 * cards, a shortfall form and a tally — a long way past where somebody stops
 * looking. Every other step in the flow ends in a full-width "Save and
 * continue"; this one ended in a link that a studio who had just added their
 * third project would never scroll to. The report was "it is stuck on that
 * page", and being stuck and being unable to find the door look identical
 * from the inside.
 *
 * ## Nothing to save
 *
 * A project is written when the modal closes, so there is no unsaved state
 * here and this is a link rather than a submit. It carries `?done=portfolio`
 * the same way the footer does, so the next step opens on its acknowledgement
 * — and re-derives the claim before printing it.
 */
function Continue({
  href,
  ready,
  remaining,
}: {
  href: string;
  ready: boolean;
  remaining: number;
}) {
  if (!ready) {
    return (
      <p className="m-0 border-t border-[var(--color-rule)] pt-5 text-[14px] text-[var(--color-ink-2)]">
        {remaining === 1
          ? 'One more project and you can move on.'
          : `${remaining} more projects and you can move on.`}{' '}
        Or tell us what you have instead, above.
      </p>
    );
  }

  return (
    <div className="border-t border-[var(--color-rule)] pt-5">
      <Link
        href={href}
        className="oi-save inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--color-petrol)] px-7 py-3.5 text-[15px] font-medium text-[var(--color-paper)] no-underline"
      >
        Save and continue
        <span aria-hidden="true">→</span>
      </Link>
      <p className="m-0 mt-2.5 text-center text-[13px] text-[var(--color-ink-3)]">
        Everything here is already saved. You can come back and add more at any time.
      </p>
    </div>
  );
}

function EmptyState({ onAdd, minimum }: { onAdd: () => void; minimum: number }) {
  return (
    <div className="rounded-[16px] border border-dashed border-[var(--color-rule)] bg-[var(--color-paper-2)] px-6 py-12 text-center">
      <p className="h2 m-0 mb-2">Show us what you have built</p>
      <p className="mx-auto m-0 mb-6 max-w-[46ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
        {minimum} finished projects, with photographs. This is the part of your profile a customer
        actually reads — more than the description, more than the years.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="oi-save inline-flex items-center gap-2 rounded-[12px] bg-[var(--color-petrol)] px-7 py-3.5 text-[15px] font-medium text-[var(--color-paper)]"
      >
        <span aria-hidden="true">+</span> Add your first project
      </button>
      <p className="m-0 mt-4 text-[13px] text-[var(--color-ink-3)]">
        Takes about three minutes each. You can come back and add more later.
      </p>
    </div>
  );
}

/**
 * How many, against how many are needed.
 *
 * Marks rather than a percentage bar. Three is a number somebody can hold in
 * their head, and "2 of 3" with two filled marks says the same thing as "67%"
 * without asking anybody to divide.
 */
function Tally({ count, minimum }: { count: number; minimum: number }) {
  const enough = count >= minimum;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[12px] px-5 py-3.5 ${
        enough
          ? 'bg-[var(--color-ontrack-soft)]'
          : 'bg-[var(--color-paper-2)]'
      }`}
    >
      <p
        className={`m-0 text-[14px] ${
          enough ? 'text-[var(--color-ontrack)]' : 'text-[var(--color-ink-2)]'
        }`}
      >
        {enough
          ? 'Enough to be listed. A customer sees all of them.'
          : 'Three finished projects is the bar for being listed.'}
      </p>
      <p className="m-0 flex items-center gap-2 text-[13.5px] font-medium text-[var(--color-ink)]">
        <span className="flex gap-1" aria-hidden="true">
          {Array.from({ length: Math.max(minimum, count) }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full ${
                i < count ? 'bg-[var(--color-ontrack)]' : 'bg-[var(--color-rule)]'
              }`}
            />
          ))}
        </span>
        {count} of {minimum} added
      </p>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectRow }) {
  const [state, action, pending] = useActionState(removeProjectAction, INITIAL);
  const cover = project.images[0];

  return (
    <li className="oi-projcard group relative overflow-hidden rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-paper-3)]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="oi-projimg h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          /* Named, not a grey rectangle. A studio who added a project before
             photographs were switched on needs to know which one is short,
             and "no photographs yet" is the only honest label for it. */
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--color-ink-3)]">
            <ImageIcon {...PANEL_ICON} />
            <span className="text-[12.5px]">No photographs yet</span>
          </span>
        )}

        {project.isRender ? (
          /* On the card, not in a detail view. A render labelled as a render
             is fine; the label has to travel with the picture or it is not
             doing anything. */
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[var(--color-ink)]/85 px-2.5 py-1 text-[11px] font-medium text-white">
            Render
          </span>
        ) : null}

        {project.images.length > 1 ? (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-[var(--color-ink)]/75 px-2 py-0.5 text-[11px] text-white">
            {project.images.length}
          </span>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium text-[var(--color-ink)]">
            {project.title}
          </span>
          <span className="block truncate text-[13px] text-[var(--color-ink-2)]">
            {[
              project.locality,
              project.valuePaise ? formatINRCompact(project.valuePaise) : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'No location given'}
          </span>
        </span>

        <form action={action}>
          <input type="hidden" name="id" value={project.id} />
          <button
            type="submit"
            disabled={pending}
            aria-label={`Remove ${project.title}`}
            className="grid h-7 w-7 flex-none place-items-center rounded-full text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-atrisk-soft)] hover:text-[var(--color-atrisk)] disabled:opacity-40"
          >
            {pending ? '…' : '×'}
          </button>
        </form>
      </div>

      {state.errors?.form ? (
        <p role="alert" className="m-0 px-4 pb-3 text-[12.5px] text-[var(--color-atrisk)]">
          {state.errors.form}
        </p>
      ) : null}
    </li>
  );
}

/**
 * For the practice that does not have three yet.
 *
 * ## Why this is not a "skip" button
 *
 * A skip records nothing, so ops opens the file and finds an absence — which
 * is indistinguishable from an unfinished form. What we want is the one thing
 * a young studio can actually offer instead of a third finished flat: a site
 * we can walk into. That is checkable, and checking it is what we do anyway.
 */
function ShortfallForm({ note }: { note: string | null }) {
  const [state, action, pending] = useActionState(declarePortfolioShortfallAction, INITIAL);
  const err = state.errors ?? {};

  return (
    <form
      action={action}
      className="flex flex-col gap-5 rounded-[14px] border border-dashed border-[var(--color-rule)] bg-[var(--color-paper-2)] p-6"
    >
      <div>
        <p className="h3 m-0 mb-2">Not three yet?</p>
        <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          Tell us what you do have — work in progress, a project you finished under a previous
          practice, a site we could come and stand in. A practice three years old with two finished
          flats and one running is exactly the kind of studio we want, and we would rather read
          this than have you stop here.
        </p>
      </div>

      <div>
        <label htmlFor="portfolioShortfallNote" className="label m-0 mb-2 block">
          What you have instead
        </label>
        <textarea
          id="portfolioShortfallNote"
          name="portfolioShortfallNote"
          rows={4}
          defaultValue={note ?? ''}
          placeholder="Two finished — the Wakad 2 BHK and a kitchen in Baner. A third handing over in November, and you are welcome to see it now. I ran two more at my last practice; the client would vouch for one of them."
          className="oi-input w-full rounded-[12px] border border-[var(--color-rule)] px-5 py-4 text-[15.5px] leading-relaxed"
        />
        {err.portfolioShortfallNote ? (
          <p role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
            {err.portfolioShortfallNote}
          </p>
        ) : null}
      </div>

      {note ? (
        <p className="m-0 text-[14px] leading-relaxed text-[var(--color-ontrack)]">
          Recorded — this step will not hold you up. It is read by a person, not scored, and it
          does not by itself put you on the roster.
        </p>
      ) : null}

      <SaveBar
        pending={pending}
        saved={state.status === 'saved'}
        formError={err.form}
        label="Save this"
      />
    </form>
  );
}
