'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import {
  addProjectAction,
  uploadProjectImagesAction,
  type ImagesState,
  type StepState,
} from './actions';
import { PROPERTY_LABELS, SCOPE_LABELS, STYLE_LABELS } from '@/modules/brief/types';

const INITIAL: StepState = { status: 'idle' };
const IMAGES_INITIAL: ImagesState = { status: 'idle' };

/**
 * `owns` is every key `addProject` can reject that lives on this stage.
 *
 * Without it this modal repeats the bug the application form had: each error
 * renders beside its field, every stage but one is `hidden`, so submitting
 * from the last stage with a bad title puts the message in a div nobody can
 * see and the button appears to do nothing at all.
 *
 * It must name every key the server can return. `clientConsented` carries the
 * render/consent rule and is the likeliest rejection of the four, since it
 * fires whenever neither box is ticked.
 */
const STAGES = [
  { label: 'Basic info', hint: 'Project details', owns: ['title'] },
  { label: 'Photographs', hint: 'Show the work', owns: [] },
  { label: 'The numbers', hint: 'Budget, timing', owns: ['completedOn'] },
  { label: 'Style', hint: 'How it reads', owns: ['styleTags', 'clientConsented'] },
] as const;

/** Which stage a rejected field lives on, or null if nothing claims it. */
function stageOwning(field: string): number | null {
  const i = STAGES.findIndex((s) => (s.owns as readonly string[]).includes(field));
  return i === -1 ? null : i;
}

/** What to call each field in the summary. */
const FIELD_LABELS: Record<string, string> = {
  title: 'Project name',
  styleTags: 'Style',
  clientConsented: 'Permission',
  completedOn: 'Finished on',
};

/**
 * Adding one project, four stages deep.
 *
 * ## Why a modal rather than the page
 *
 * The form was sixteen controls in a column under the list of projects
 * already added, so the page was longest exactly when the studio had done the
 * most work. A project is a discrete thing somebody sits down to enter; the
 * page's job is to show what they have, and this is the thing they open on
 * top of it.
 *
 * ## The stages are a view, not four forms
 *
 * Every field stays mounted and only the current stage is shown, which is the
 * same arrangement `/apply` uses and for the same reason — one submit, one
 * FormData, everything present. It also means going back and forth costs
 * nothing and loses nothing.
 *
 * `hidden` and not unmounting: an unmounted input is not in the FormData at
 * all, so a studio who filled in stage one and walked forward would submit a
 * project with no title. That is the bug this arrangement exists to prevent,
 * and it is invisible until somebody does it.
 *
 * ## Photographs upload immediately; everything else waits
 *
 * A picture has to appear to be worth anything — you cannot order what you
 * cannot see, and the first one is the cover. So the bytes go up on drop and
 * the URLs are held here until the row is written. See `uploadProjectImages`
 * for what that costs and why it is the right way round.
 *
 * ## Focus and escape
 *
 * Opening moves focus into the dialog and closing puts it back on the button
 * that opened it, because a modal that leaves focus behind it drops a
 * keyboard user at the top of the document with no way back to where they
 * were. Escape closes. The backdrop does not — this holds up to ten minutes
 * of typing and a stray click outside should not discard it.
 */
export function ProjectModal({
  open,
  onClose,
  uploadEnabled,
}: {
  open: boolean;
  onClose: () => void;
  uploadEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(addProjectAction, INITIAL);
  const [stage, setStage] = useState(0);
  const [images, setImages] = useState<string[]>([]);

  /**
   * The three things `addProject` refuses on, held here so the button can
   * say what is short BEFORE it is pressed.
   *
   * This modal was reported as "not working": the studio filled it in,
   * pressed Add, and nothing visible happened. Every one of its rejections
   * is for something that was never asked for on screen — no style picked,
   * neither permission box ticked — so the honest fix is not a better error
   * message after the fact, it is not letting somebody reach the end
   * believing they are finished. Same arrangement as step one.
   */
  const [title, setTitle] = useState('');
  const [styles, setStyles] = useState<string[]>([]);
  const [consented, setConsented] = useState(false);
  const [isRender, setIsRender] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);

  const err = state.errors ?? {};
  /* `form` already renders on its own above. */
  const fieldErrors = Object.entries(err).filter(([k]) => k !== 'form');

  /* One entry per thing, never per stage — the lesson from the profile step,
     where "years and team size" as one line made a working select look
     broken. Each leaves the list the moment it is satisfied. */
  const missing = [
    title.trim().length < 3 ? { what: 'a project name', stage: 0 } : null,
    styles.length === 0 ? { what: 'at least one style', stage: 3 } : null,
    !consented && !isRender
      ? { what: 'the client\u2019s permission, or a render mark', stage: 3 }
      : null,
  ].filter((m): m is { what: string; stage: number } => m !== null);

  /* A successful add closes the modal and resets it, so the next "Add
     project" opens on an empty stage one rather than on the last one filled
     in. Keyed on the state object, which is new per submission. */
  useEffect(() => {
    if (state.status !== 'saved') return;
    setStage(0);
    setImages([]);
    setTitle('');
    setStyles([]);
    setConsented(false);
    setIsRender(false);
    onClose();
  }, [state, onClose]);

  /**
   * A rejected submit lands on the stage that was rejected.
   *
   * The button is on the last stage and every other stage is `hidden`, so
   * without this an error on the title renders into a div on stage one and
   * nothing happens on screen: no message, no movement, the button just
   * un-greys. That is exactly the failure the application form had, reported
   * as "I click send and it returns nothing".
   *
   * Earliest stage first, so somebody fixing two things works forwards
   * through the modal the way they filled it in.
   */
  useEffect(() => {
    if (state.status !== 'error') return;
    const target = Object.keys(state.errors ?? {})
      .filter((k) => k !== 'form')
      .map(stageOwning)
      .filter((i): i is number => i !== null)
      .sort((a, b) => a - b)[0];
    if (target !== undefined) setStage(target);
  }, [state]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    firstField.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    /* The page behind must not scroll while this is open, or a phone shows
       the studio the form sliding away under their thumb. */
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const last = stage === STAGES.length - 1;

  return (
    <div className="oi-modal-wrap fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(28,24,20,0.45)] p-4 sm:items-center sm:p-6">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
        className="oi-modal w-full max-w-[56rem] rounded-[18px] bg-[var(--color-paper)] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-rule)] px-6 py-5">
          <div>
            <h2 id="project-modal-title" className="h2 m-0 text-[22px]">
              Add a project
            </h2>
            <p className="m-0 mt-0.5 text-[14px] text-[var(--color-ink-2)]">
              One of the three a customer will read before anything else.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 grid h-9 w-9 flex-none place-items-center rounded-full text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 4 L12 12 M12 4 L4 12" />
            </svg>
          </button>
        </header>

        {/* Native validation off, for the reason ApplyForm sets out at
            length: every stage but one is `hidden`, and a browser that finds
            an invalid control on submit refuses to submit and then cannot
            focus it to explain why. The result is a button that does nothing
            at all, forever, with nothing on screen.
        
            The traps here are the date and the two number inputs. A partial
            date, or a number left in a bad-input state — which is easy on a
            phone keyboard — sits on a hidden stage and silently cancels
            every submit from the last one. Presence is checked by `missing`
            above and `addProject` validates everything again on the server,
            so nothing is lost by switching this off. */}
        <form
          noValidate
          action={action}
          className="grid grid-cols-1 gap-0 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]"
        >
          <StageRail stage={stage} onPick={setStage} />

          <div className="min-w-0 px-6 py-5">
            {/* ── 1. Basic ── */}
            <div hidden={stage !== 0} className="flex flex-col gap-4">
              <Text
                ref={firstField}
                label="Project name"
                name="title"
                value={title}
                onChange={setTitle}
                placeholder="The Kharadi 3 BHK"
                error={err.title}
                required
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Text label="Where" name="locality" placeholder="Baner, Pune" />
                <Select label="Property type" name="propertyType" options={PROPERTY_LABELS} />
              </div>
              <Select label="What you did" name="scope" options={SCOPE_LABELS} />
            </div>

            {/* ── 2. Photographs ── */}
            <div hidden={stage !== 1}>
              <ImageStage
                images={images}
                onChange={setImages}
                enabled={uploadEnabled}
                active={stage === 1}
              />
            </div>

            {/* ── 3. Numbers ── */}
            <div hidden={stage !== 2} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Text
                  label="What it came to"
                  name="valueLakhs"
                  type="number"
                  step="0.5"
                  placeholder="18.5"
                  suffix="₹ lakh"
                  hint="Optional. It helps us match you to briefs of the right size."
                />
                <Text
                  label="How long it took"
                  name="durationDays"
                  type="number"
                  placeholder="95"
                  suffix="days"
                  hint="Optional."
                />
              </div>
              <Text
                label="Finished on"
                name="completedOn"
                type="date"
                error={err.completedOn}
                hint="This list is for finished work. A project still running belongs in the note on the step behind this one."
              />
            </div>

            {/* ── 4. Style and the honesty checks ── */}
            <div hidden={stage !== 3} className="flex flex-col gap-5">
              <fieldset className="m-0 border-0 p-0">
                <legend className="label m-0 mb-1 p-0">Style</legend>
                <p className="m-0 mb-3 max-w-[54ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
                  {/* Stated plainly because it is not obvious and it is the
                      reason the list is fixed rather than free text. */}
                  The same words the customer quiz uses. A style of your own
                  invention would never match anybody.
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STYLE_LABELS).map(([value, label]) => (
                    <label
                      key={value}
                      className="oi-chip inline-flex cursor-pointer items-center rounded-full border border-[var(--color-rule)] px-4 py-2 text-[14px] text-[var(--color-ink-2)] has-[:checked]:border-transparent has-[:checked]:bg-[var(--color-petrol)] has-[:checked]:text-white"
                    >
                      <input
                        type="checkbox"
                        name="styleTags"
                        value={value}
                        checked={styles.includes(value)}
                        onChange={() =>
                          setStyles((prev) =>
                            prev.includes(value)
                              ? prev.filter((v) => v !== value)
                              : [...prev, value],
                          )
                        }
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {err.styleTags ? (
                  <p role="alert" className="m-0 mt-2 text-[13.5px] text-[var(--color-atrisk)]">
                    {err.styleTags}
                  </p>
                ) : null}
              </fieldset>

              <div className="flex flex-col gap-3 rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-4">
                {/* Said before the boxes, not discovered by pressing the
                    button. One of the two is required and neither is ticked
                    by default, so without this line the commonest way to
                    reach the end of this modal is with a project that will be
                    refused for a rule nobody stated. */}
                <p className="m-0 text-[13px] font-medium text-[var(--color-ink-2)]">
                  Tick at least one of these.
                </p>
                <Check
                  name="clientConsented"
                  checked={consented}
                  onChange={setConsented}
                  label="The client is happy for this to be shown"
                  hint="We may call them. Nothing here is published before you approve your own profile."
                />
                <Check
                  name="isRender"
                  checked={isRender}
                  onChange={setIsRender}
                  label="These are renders, not photographs"
                  /* The rule, stated as a rule. It is enforced in
                     `addProject` and it is the one thing on this screen we
                     will remove a studio for. */
                  hint="A render marked as a render is perfectly fine. A render passed off as a finished room is the one thing we will take a studio off the roster for."
                />
                {err.clientConsented ? (
                  <p role="alert" className="m-0 text-[13.5px] text-[var(--color-atrisk)]">
                    {err.clientConsented}
                  </p>
                ) : null}
              </div>
            </div>

            {/* The URLs travel with the form. Hidden inputs rather than a
                JSON blob, so the order in the DOM is the order that arrives
                and the first really is the cover. */}
            {images.map((url) => (
              <input key={url} type="hidden" name="images" value={url} />
            ))}

            {err.form ? (
              <p role="alert" className="m-0 mt-4 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-2.5 text-[14px] text-[var(--color-atrisk)]">
                {err.form}
              </p>
            ) : null}

            {/* Outside the stage divs, so it cannot be the thing that is
                hidden. The effect above moves to the first problem; this says
                how many others are waiting, which one focused stage cannot. */}
            {fieldErrors.length > 0 ? (
              <div role="alert" className="mt-4 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-3">
                <p className="m-0 mb-1 text-[13.5px] font-semibold text-[var(--color-atrisk)]">
                  {fieldErrors.length === 1
                    ? 'One thing to fix before this can be added.'
                    : `${fieldErrors.length} things to fix before this can be added.`}
                </p>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {fieldErrors.map(([name, message]) => (
                    <li key={name} className="text-[13.5px] leading-relaxed text-[var(--color-atrisk)]">
                      <span className="font-medium">{FIELD_LABELS[name] ?? name}</span> — {message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-rule)] pt-5">
              {stage > 0 ? (
                <button
                  type="button"
                  onClick={() => setStage((s) => s - 1)}
                  className="text-[14px] text-[var(--color-ink-2)] underline underline-offset-4 hover:text-[var(--color-ink)]"
                >
                  ← {STAGES[stage - 1]!.label}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[14px] text-[var(--color-ink-3)] underline underline-offset-4 hover:text-[var(--color-ink)]"
                >
                  Cancel
                </button>
              )}

              {last ? (
                /* The list is the control, the same rule the step footer
                   follows. A button that looks alive, is pressed, and does
                   nothing is what this modal was reported as — and the cause
                   was never the button, it was three requirements that were
                   only stated by refusing. */
                <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
                  {missing.length > 0 ? (
                    <p className="m-0 max-w-[30ch] text-right text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                      Still needed:{' '}
                      {missing.map((m, i) => (
                        <span key={m.what}>
                          {i > 0 ? ', ' : ''}
                          {/* Each one is a way back to where it is fixed, so
                              a requirement on a stage behind you is one click
                              rather than a hunt. */}
                          <button
                            type="button"
                            onClick={() => setStage(m.stage)}
                            className="underline underline-offset-2 hover:text-[var(--color-ink)]"
                          >
                            {m.what}
                          </button>
                        </span>
                      ))}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={pending || missing.length > 0}
                    className="oi-save inline-flex items-center gap-2 rounded-[11px] bg-[var(--color-petrol)] px-6 py-2.5 text-[14.5px] font-medium text-[var(--color-paper)] disabled:cursor-not-allowed disabled:bg-[var(--color-ink-3)] disabled:opacity-60"
                  >
                    {pending ? 'Adding…' : 'Add this project'}
                  </button>
                </div>
              ) : (
                /* `type="button"`. As a submit it would be the form's first
                   submit control, so Enter in the title field would post an
                   empty project instead of moving on. */
                <button
                  type="button"
                  onClick={() => setStage((s) => s + 1)}
                  className="oi-save inline-flex items-center gap-2 rounded-[11px] bg-[var(--color-petrol)] px-6 py-2.5 text-[14.5px] font-medium text-[var(--color-paper)]"
                >
                  Next
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </footer>
          </div>
        </form>
      </div>
    </div>
  );
}

function StageRail({ stage, onPick }: { stage: number; onPick: (n: number) => void }) {
  return (
    <ol className="m-0 flex list-none gap-1 overflow-x-auto border-b border-[var(--color-rule)] p-4 sm:flex-col sm:gap-0.5 sm:border-b-0 sm:border-r sm:p-5">
      {STAGES.map((s, i) => {
        const done = i < stage;
        const here = i === stage;
        return (
          <li key={s.label} className="flex-none sm:flex-auto">
            {/* Every stage is reachable at any time. Nothing here is
                validated on the way past, so locking a stage behind the one
                before it would be theatre — and it would stop somebody
                dropping photographs in before they have settled on a name. */}
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-current={here ? 'step' : undefined}
              className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors ${
                here ? 'bg-[var(--color-paper-2)]' : 'hover:bg-[var(--color-paper-2)]'
              }`}
            >
              <span
                className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[11.5px] font-semibold ${
                  done
                    ? 'bg-[var(--color-ontrack)] text-white'
                    : here
                      ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                      : 'border border-[var(--color-rule)] text-[var(--color-ink-3)]'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-[13.5px] font-medium text-[var(--color-ink)]">
                  {s.label}
                </span>
                <span className="hidden text-[12px] text-[var(--color-ink-3)] sm:block">
                  {s.hint}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Drop pictures, watch them arrive, drag to reorder.
 *
 * The first in the array is the cover and it says so on the tile rather than
 * in a sentence underneath, because "the first image will be the cover" is a
 * rule somebody reads once and then cannot check without counting.
 *
 * Reordering is HTML drag and drop on the tiles, with the arrows as the
 * accessible equivalent — a drag has no keyboard story at all, and "first is
 * the cover" is exactly the kind of decision somebody needs to be able to
 * make without a mouse.
 */
function ImageStage({
  images,
  onChange,
  enabled,
  active,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  enabled: boolean;
  active: boolean;
}) {
  const [state, action, pending] = useActionState(uploadProjectImagesAction, IMAGES_INITIAL);
  const [over, setOver] = useState(false);
  const dragFrom = useRef<number | null>(null);

  /* New URLs are appended as they come back. Keyed on the state object so a
     second upload of the same picture still lands — `urls` alone would be
     deep-equal and the effect would not run. */
  useEffect(() => {
    if (state.status !== 'saved' || !state.urls) return;
    onChange([...images, ...state.urls]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function send(files: FileList | null) {
    if (!files || files.length === 0 || !enabled) return;
    const data = new FormData();
    for (const file of Array.from(files)) data.append('images', file);
    startTransition(() => action(data));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    if (item) next.splice(to, 0, item);
    onChange(next);
  }

  if (!enabled) {
    return (
      <p className="m-0 rounded-[11px] bg-[var(--color-paper-2)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
        Photographs are not switched on here yet. Add the project without them and send the
        pictures to studios@oneinteriors.in — we will put them on. It does not hold this step up.
      </p>
    );
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          send(e.dataTransfer.files);
        }}
        className={`oi-drop flex cursor-pointer flex-col items-center justify-center rounded-[14px] border-2 border-dashed px-6 py-7 text-center ${
          over
            ? 'border-[var(--color-petrol)] bg-[var(--color-petrol-soft)]'
            : 'border-[var(--color-rule)] bg-[var(--color-paper-2)]'
        } ${pending ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            send(e.target.files);
            /* Cleared so choosing the same file twice in a row fires change
               again. Without this the second attempt is silent. */
            e.target.value = '';
          }}
          className="sr-only"
          disabled={pending || !active}
        />
        <span className="text-[15px] font-medium text-[var(--color-ink)]">
          {pending ? 'Uploading…' : 'Drag photographs here'}
        </span>
        <span className="mt-0.5 text-[13.5px] text-[var(--color-ink-2)]">
          {pending ? 'One moment.' : 'or click to choose them'}
        </span>
        <span className="mt-2 text-[12.5px] text-[var(--color-ink-3)]">
          JPG, PNG or WebP, up to 8 MB each
        </span>
      </label>

      {state.skipped && state.skipped.length > 0 ? (
        <ul className="m-0 mt-3 flex list-none flex-col gap-1 rounded-[10px] border border-[var(--color-brass)]/35 bg-[var(--color-brass-soft)] px-4 py-2.5 p-0">
          {state.skipped.map((message) => (
            <li key={message} className="text-[13px] leading-relaxed text-[var(--color-ink)]">
              {message}
            </li>
          ))}
        </ul>
      ) : null}

      {images.length > 0 ? (
        <>
          <p className="label m-0 mb-2 mt-5">
            {images.length} {images.length === 1 ? 'photograph' : 'photographs'} — drag to reorder
          </p>
          <ul className="m-0 grid list-none grid-cols-3 gap-2.5 p-0 sm:grid-cols-4">
            {images.map((url, i) => (
              <li
                key={url}
                draggable
                onDragStart={() => {
                  dragFrom.current = i;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragFrom.current !== null) move(dragFrom.current, i);
                  dragFrom.current = null;
                }}
                className="oi-tile group relative aspect-[4/3] overflow-hidden rounded-[10px] border border-[var(--color-rule)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />

                {i === 0 ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[var(--color-ink)]/85 px-2 py-0.5 text-[10.5px] font-medium text-white">
                    Cover
                  </span>
                ) : null}

                <span className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <span className="flex gap-1">
                    <Tile onClick={() => move(i, i - 1)} label="Move earlier" disabled={i === 0}>
                      ←
                    </Tile>
                    <Tile
                      onClick={() => move(i, i + 1)}
                      label="Move later"
                      disabled={i === images.length - 1}
                    >
                      →
                    </Tile>
                  </span>
                  <Tile
                    onClick={() => onChange(images.filter((u) => u !== url))}
                    label="Remove"
                  >
                    ×
                  </Tile>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function Tile({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-ink)]/85 text-[13px] leading-none text-white transition-opacity hover:bg-[var(--color-ink)] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const Text = function Text({
  ref,
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  error,
  suffix,
  step,
  required,
}: {
  ref?: React.Ref<HTMLInputElement>;
  label: string;
  name: string;
  /** Controlled only where something watches the value. */
  value?: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  suffix?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={`p-${name}`} className="label m-0 mb-1.5 block">
        {label}
        {required ? <span className="text-[var(--color-atrisk)]"> *</span> : null}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={`p-${name}`}
          name={name}
          type={type}
          step={step}
          {...(onChange ? { value: value ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) } : {})}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className={`oi-input w-full rounded-[11px] border border-[var(--color-rule)] px-4 py-2.5 text-[14.5px] ${
            suffix ? 'pr-16' : ''
          }`}
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-[var(--color-ink-3)]"
          >
            {suffix}
          </span>
        ) : null}
      </div>
      {hint && !error ? (
        <p className="m-0 mt-1.5 max-w-[52ch] text-[12.5px] leading-relaxed text-[var(--color-ink-3)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 mt-1.5 text-[13px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : null}
    </div>
  );
};

function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: Record<string, string>;
}) {
  return (
    <div>
      <label htmlFor={`p-${name}`} className="label m-0 mb-1.5 block">
        {label}
      </label>
      <select
        id={`p-${name}`}
        name={name}
        defaultValue=""
        className="oi-input w-full rounded-[11px] border border-[var(--color-rule)] px-4 py-2.5 text-[14.5px]"
      >
        <option value="">Not saying</option>
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function Check({
  name,
  label,
  hint,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-[17px] w-[17px] flex-none accent-[var(--color-petrol)]"
      />
      <span className="min-w-0">
        <span className="block text-[14.5px] text-[var(--color-ink)]">{label}</span>
        <span className="block text-[12.5px] leading-relaxed text-[var(--color-ink-2)]">
          {hint}
        </span>
      </span>
    </label>
  );
}
