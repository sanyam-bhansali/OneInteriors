'use client';

/**
 * The brief — eleven short screens in seven chapters (modules/brief/steps.ts).
 *
 * Layout: question on the left in large display serif, options on the right as
 * soft circular tiles. That split does two things at once — it gives the
 * question the weight of somebody actually asking it, and it keeps the options
 * to a small, calm cluster instead of a form.
 *
 * Three rules the implementation must keep:
 *  1. One question per screen. Progress always visible.
 *  2. The live profile panel updates on every answer — the user watches the
 *     machine work. That, not gamification, is what holds them through Q7.
 *  3. The number comes last. Progressive commitment: never ask for more than
 *     the customer has earned reason to give. Since 29 Sep the brief does take
 *     a name and number (the owner's direction — the matches greet them and
 *     the expert call books without a form), so the name is the first screen,
 *     costing nothing, and the number is the last, after four minutes that
 *     show what it is for, and only with the notice agreed.
 */

import { HomeSketch } from '@/components/oi/HomeSketch';
import { SwipeOrGrid, SwipePicker } from './SwipePicker';
import { ThisOrThat } from './ThisOrThat';
import { studioPickerPhotos, type PickerPhoto } from '@/modules/brief/picker-photos';
import { SocietyInput } from './SocietyInput';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mark } from '@/components/brand';
import { Wrap, Sheet, DocRow } from '@/components/oi';
import { formatINRCompact } from '@/lib/money';
import { TIER, TIERS, perSqftLabel, tierRangeFor } from '@/modules/quotation/tiers';
import { checklistFor, roomsFor, scopePhrase, selectionOf } from '@/modules/quotation/scope';
import { scopeBandRange, scopeShare } from '@/modules/quotation/scope-band';
import { homeShapeFor } from '@/modules/quotation/first-quote';
import { BEDROOMS } from '@/modules/quotation/estimate';
import { ROOM_LABELS } from '@/modules/quotation/catalogue';
import { ratesAreReal } from '@/data/filed-rates';
import {
  EMPTY_BRIEF,
  INVOLVEMENT_LABELS,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  localityLabel,
  POSSESSION_LABELS,
  SCOPE_LABELS,
  STYLE_LABELS,
  STYLE_TAGS,
  HOME_NEEDS,
  HOME_NEED_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  type Brief,
  type HomeNeed,
  type Involvement,
  type PossessionStatus,
  type PriorityFactor,
  type PropertyType,
  type ScopeType,
  type StyleTag,
} from '@/modules/brief/types';
import { loadBrief, saveBrief } from '@/modules/brief/store';
import {
  CHAPTER,
  NAME_MAX,
  TOTAL_STEPS,
  carpetAreaFor,
  cleanName,
  isStepAnswered,
  stepAt,
  type StepId,
} from '@/modules/brief/steps';
import { LocalityPicker } from './LocalityPicker';
import { PlanReader } from './PlanReader';
import {
  EMPTY_CONTACT,
  checkContact,
  type ContactField,
  type ContactInput,
} from '@/modules/brief/contact';
import { PURPOSE_NOTICE } from '@/modules/consent/policy';
import { SocialButtons, anyProvider, type Providers } from '@/components/SocialButtons';
import { InspirationReader } from './InspirationReader';
import { STYLE_PHOTOS, pickerRoomFor, stylePhotoFor, stylePhotoUrl, type PickerRoom } from '@/data/style-photos';

const NO_PROVIDERS: Providers = { google: false, apple: false, facebook: false };

type ContactErrors = Partial<Record<ContactField | 'form', string>>;
import {
  FULL_HOME_DAYS,
  possessionPhrase,
  readyWindow,
} from '@/modules/brief/possession';
import {
  saveBriefAction,
  loadBriefAction,
  trackAction,
  submitContactAction,
} from './actions';
import type { Studio } from '@/modules/studio/types';
import { StyleScene, MaterialSwatches } from '@/components/art/StyleScene';
import {
  IconStudio,
  IconApartment2,
  IconApartment3,
  IconApartment4,
  IconVilla,
  IconFullHome,
  IconKitchen,
  IconSingleRoom,
  IconRenovation,
  IconHandsOff,
  IconCollaborate,
  IconHandsOn,
  IconBudget,
  IconSpeed,
  IconAmbition,
  IconMaterial,
  IconAdults,
  IconChildren,
  IconElderly,
  IconPets,
  IconWork,
} from '@/components/art/Icons';

const PROPERTY_ICONS: Record<PropertyType, React.ComponentType<{ className?: string }>> = {
  BHK_1: IconStudio,
  BHK_2: IconApartment2,
  BHK_3: IconApartment3,
  BHK_4_PLUS: IconApartment4,
  VILLA: IconVilla,
};

const SCOPE_ICONS: Record<ScopeType, React.ComponentType<{ className?: string }>> = {
  FULL_HOME: IconFullHome,
  KITCHEN_WARDROBE: IconKitchen,
  SINGLE_ROOM: IconSingleRoom,
  RENOVATION: IconRenovation,
};

const INVOLVEMENT_ICONS: Record<Involvement, React.ComponentType<{ className?: string }>> = {
  DECIDE_FOR_ME: IconHandsOff,
  COLLABORATE: IconCollaborate,
  APPROVE_EVERYTHING: IconHandsOn,
};

const PRIORITY_ICONS: Record<PriorityFactor, React.ComponentType<{ className?: string }>> = {
  BUDGET: IconBudget,
  SPEED: IconSpeed,
  DESIGN_AMBITION: IconAmbition,
  MATERIAL_QUALITY: IconMaterial,
};

/**
 * How much longer this takes, in words.
 *
 * Rounded up and deliberately never optimistic — "under a minute" that turns
 * out to be ninety seconds costs more trust than it saved, and this is a
 * product whose entire proposition is that our numbers are honest. The last
 * question says "nearly done" rather than a duration, because at that point a
 * number invites arithmetic and the answer is obviously "almost none".
 */
function minutesLeft(step: number): string {
  const remaining = TOTAL_STEPS - step + 1;
  if (remaining <= 1) return 'nearly done';
  const seconds = remaining * 20;
  if (seconds <= 60) return 'under a minute left';
  return `about ${Math.ceil(seconds / 60)} min left`;
}

export function QuizClient({
  studios,
  /** Server-decided; see MatchClient. Defaults to the strict answer. */
  allowUnverified: _allowUnverified = false,
  account = null,
  socialSignIn = NO_PROVIDERS,
}: {
  studios: Studio[];
  allowUnverified?: boolean;
  /** The signed-in account, if any. The contact screen fills in from it. */
  account?: { name: string | null; email: string | null } | null;
  /** Whether "Continue with Google" can be offered. */
  socialSignIn?: Providers;
}) {
  const router = useRouter();
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [step, setStep] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  /** True between the last answer and the tier page. Keeps the button honest. */
  const [finishing, setFinishing] = useState(false);
  /** The contact screen's fields. Held here, not in the brief — see contact.ts. */
  const [contact, setContact] = useState<ContactInput>(EMPTY_CONTACT);
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});

  useEffect(() => {
    // sessionStorage first so the quiz paints immediately, then reconcile with
    // the server. A stored brief always wins over an empty local one; a local
    // brief wins when the server has never heard of this browser.
    const local = loadBrief();
    setBrief(local);
    setStep(Math.min(Math.max(local.lastStep || 1, 1), TOTAL_STEPS));
    setHydrated(true);

    let cancelled = false;
    void loadBriefAction().then((remote) => {
      if (cancelled || !remote) return;
      // Only adopt the server copy if it is further along. Otherwise someone
      // who reloads mid-question gets thrown backwards to their last sync.
      if ((remote.lastStep ?? 0) >= (local.lastStep ?? 0)) {
        // The server has no name until the contact step; keep the one typed here.
        const adopted = { ...remote, contactName: remote.contactName ?? local.contactName };
        setBrief(adopted);
        saveBrief(adopted);
        setStep(Math.min(Math.max(remote.lastStep || 1, 1), TOTAL_STEPS));
      }
    });

    void trackAction('quiz.start');
    return () => {
      cancelled = true;
    };
  }, []);

  // One view event per step, including the first.
  useEffect(() => {
    if (!hydrated) return;
    void trackAction('quiz.step.view', { step });
  }, [step, hydrated]);

  /**
   * Put every new question back at the top of its own screen.
   *
   * The question area is a scrolling container inside a fixed frame, and its
   * scroll offset survives a step change. Answer a tall question, scroll down
   * to reach the last option, hit Continue — and the next question opens at
   * whatever offset the previous one was left at. On a tall step that means
   * landing on a grid of unlabelled options with the heading and the
   * instructions both above the fold, which is exactly what it looks like when
   * a page is broken.
   *
   * `scrollTop = 0` rather than `scrollIntoView`: this must be instant and
   * invisible. A smooth scroll here reads as the page moving on its own.
   */
  const scroller = useRef<HTMLElement | null>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);

  function update(patch: Partial<Brief>) {
    setBrief((prev) => {
      const next = { ...prev, ...patch, lastStep: step };
      saveBrief(next);
      return next;
    });
  }

  /**
   * Persist to the server without blocking the UI. The local copy is already
   * written by the time this fires, so a rejected promise costs the sync and
   * nothing else.
   */
  function sync(next: Brief) {
    // The name stays in this tab until the contact step sends it with the
    // number, after consent. The mapper would drop it anyway; not sending it
    // at all is the stronger guarantee.
    void saveBriefAction({ ...next, contactName: null }).catch(() => {});
  }

  /**
   * Leave the brief for the matches.
   *
   * The one sync that is waited on. Every other write is fire-and-forget so
   * Continue never feels slow. This one carries `completedAt`, and every
   * server-rendered step after this point refuses to work without it. Waited
   * on, but never blocking: a second, then we move regardless. BriefRescue
   * picks up whatever did not land.
   */
  function finish(from: Brief) {
    const done = { ...from, completedAt: new Date().toISOString(), lastStep: TOTAL_STEPS };
    setBrief(done);
    saveBrief(done);
    void trackAction('quiz.complete');

    setFinishing(true);
    void Promise.race([
      saveBriefAction({ ...done, contactName: null }).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]).then(() => router.push('/match'));
  }

  /**
   * The last screen: check, then send the contact details, then finish.
   *
   * Checked here first with the same rules the server applies, so a missing
   * number is said against its field without a round trip. The server then
   * records the agreement before it writes a single detail.
   */
  async function submitContact() {
    const input = { ...contact, name: contact.name || brief.contactName || '' };
    const check = checkContact(input);
    if (!check.ok) {
      setContactErrors(check.errors);
      return;
    }
    setContactErrors({});
    setFinishing(true);

    const result = await submitContactAction(brief, input).catch(() => null);
    if (result && !result.ok) {
      setContactErrors(result.errors);
      setFinishing(false);
      return;
    }
    finish({ ...brief, contactName: check.value.name });
  }

  function next() {
    void trackAction('quiz.step.complete', { step });

    if (stepId === 'contact') {
      void submitContact();
      return;
    }
    if (step >= TOTAL_STEPS) {
      finish(brief);
      return;
    }
    const n = step + 1;
    setStep(n);
    const advanced = { ...brief, lastStep: n };
    saveBrief(advanced);
    sync(advanced);
  }

  function back() {
    if (step <= 1) {
      router.push('/');
      return;
    }
    setStep(step - 1);
  }

  const stepId = stepAt(step);
  const canAdvance = isStepAnswered(brief, stepId);
  const pickerPhotos = useMemo(() => studioPickerPhotos(studios), [studios]);

  const contactCtx: ContactContext = {
    account,
    socialSignIn,
    contact,
    setContact: (next) => {
      setContact(next);
      // An error disappears as soon as they start fixing it.
      if (Object.keys(contactErrors).length > 0) setContactErrors({});
    },
    errors: contactErrors,
    pickerPhotos,
  };

  if (!hydrated) {
    return (
      <div className="oi-app min-h-dvh bg-[var(--bg)] py-16">
        <Wrap>
          <p className="oi-label m-0">Loading…</p>
        </Wrap>
      </div>
    );
  }

  return (
    <div className="oi-app flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--card)]">
        <Wrap>
          <div className="flex items-center justify-between gap-4 py-3.5">
            <Link
              href="/"
              className="flex items-center gap-2.5 no-underline"
              aria-label="One Interiors, home"
            >
              <Mark className="h-[18px] w-[18px] text-[var(--ink)]" />
              {/* The mark alone on a phone: the wordmark wrapped to two lines
                  there and pushed the chapter and time off the right edge. */}
              <span className="oi-display hidden text-[17px] leading-none text-[var(--ink)] sm:inline">
                One Interiors
              </span>
            </Link>
            {/* Time left, not a count.
                "Question 3 of 9" answers a question nobody asked. What someone
                deciding whether to keep going actually wants to know is how
                much longer this is — and an honest estimate is far more
                motivating than an index. Calibrated at roughly twenty seconds
                a question, which is what the nine-questions promise on the
                landing page implies, so the two cannot contradict. */}
            {/* The chapter, then how long is left. The count is dropped on a
                phone, where the three together ran off the edge of the screen;
                the chapter and the time are the two parts that answer "how
                much more of this is there". */}
            <span className="oi-num min-w-0 truncate text-right text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink2)]">
              {CHAPTER[stepId]}
              <span className="hidden sm:inline">
                {' '}
                · {step} of {TOTAL_STEPS}
              </span>{' '}
              · {minutesLeft(step)}
            </span>
          </div>
        </Wrap>
        <div
          className="h-[3px] w-full bg-[var(--line)]"
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
        >
          {/* The bar never starts empty.
              A zero-width bar on question one reads as "you have done
              nothing", which is both discouraging and untrue — they have
              already decided to start, which is the hardest step. The floor is
              a visual minimum only: the time remaining is stated in words
              right above it, so nothing here overstates progress. */}
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.max(7, (step / TOTAL_STEPS) * 100)}%`,
              background: 'var(--acc)',
            }}
          />
        </div>
      </header>

      {/* A fixed three-part frame: header, a scrolling question area, and a
          footer that never leaves the viewport.

          The first build put Continue after the options AND after the running
          brief, so answering a question meant scrolling down to find the
          button — on every one of the nine. A quiz where the primary action is
          below the fold reads as broken, however good the question above it. */}
      <main ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <Wrap>
          <div className="grid grid-cols-1 gap-9 py-8 sm:py-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
            <div key={`q-${step}`} className="oi-swap flex flex-col gap-7">
              <QuestionStep id={stepId} brief={brief} update={update} slot="ask" ctx={contactCtx} />
              <LiveProfile brief={brief} className="hidden lg:block" />
            </div>

            <div key={`o-${step}`} className="oi-swap min-w-0">
              <QuestionStep id={stepId} brief={brief} update={update} slot="options" ctx={contactCtx} />

              {/* On a phone the brief is COLLAPSED by default.
                  It is reassurance, not information the customer needs to
                  answer the question in front of them — and expanded it pushed
                  the options down far enough that the question and its answers
                  no longer shared a screen. One tap for anyone who wants to
                  check what we have understood; out of the way for everyone
                  else. On a laptop it stays open in the left column, where it
                  costs no vertical space at all. */}
              <details className="group mt-7 border border-[var(--line)] bg-[var(--card)] lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span className="oi-label m-0">
                    {cleanName(brief.contactName)
                      ? `${cleanName(brief.contactName)}'s brief so far`
                      : 'Your brief so far'}
                  </span>
                  <span className="oi-num text-[10.5px] uppercase tracking-[0.14em] text-[var(--acc-ink)] group-open:hidden">
                    Show
                  </span>
                  <span className="oi-num hidden text-[10.5px] uppercase tracking-[0.14em] text-[var(--acc-ink)] group-open:inline">
                    Hide
                  </span>
                </summary>
                <div className="border-t border-[var(--line)] p-4">
                  <LiveProfile brief={brief} bare />
                </div>
              </details>
            </div>
          </div>
        </Wrap>
      </main>

      <footer className="sticky bottom-0 z-10 border-t border-[var(--line)] bg-[var(--card)]/95 backdrop-blur">
        <Wrap>
          <div className="flex items-center justify-between gap-4 py-4">
            <button
              type="button"
              onClick={back}
              className="cursor-pointer border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 text-[13.5px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--ink2)]"
            >
              Back
            </button>

            <div className="flex items-center gap-4">
              {!canAdvance ? (
                <span className="hidden text-[13.5px] text-[var(--ink2)] sm:inline">
                  Pick an answer to continue
                </span>
              ) : null}
              {/* The one terracotta thing on the screen. */}
              <button
                type="button"
                onClick={next}
                disabled={!canAdvance || finishing}
                className="cursor-pointer px-6 py-3 text-[14.5px] font-medium text-white transition-colors disabled:opacity-40"
                style={{ background: 'var(--acc-btn)' }}
              >
                {finishing
                  ? 'Writing your brief…'
                  : step === TOTAL_STEPS
                    ? 'See who fits'
                    : 'Continue'}
              </button>
            </div>
          </div>
        </Wrap>
      </footer>
    </div>
  );
}

// ── Steps ──────────────────────────────────────────────────────

/**
 * Each step yields two pieces: the question (left column) and the controls
 * (right column). Keeping them defined together means the copy and the inputs
 * it refers to can never drift apart, while still rendering into separate
 * tracks of the layout.
 */
type StepParts = { ask: React.ReactNode; options: React.ReactNode };

/** What the contact screen needs beyond the brief. */
interface ContactContext {
  account: { name: string | null; email: string | null } | null;
  socialSignIn: Providers;
  contact: ContactInput;
  setContact: (next: ContactInput) => void;
  errors: ContactErrors;
  /** Studios' own photos for the style picker, unnamed (brief/picker-photos.ts). */
  pickerPhotos: Partial<Record<StyleTag, PickerPhoto>>;
}

function QuestionStep({
  id,
  brief,
  update,
  slot,
  ctx,
}: {
  id: StepId;
  brief: Brief;
  update: (patch: Partial<Brief>) => void;
  slot: 'ask' | 'options';
  ctx: ContactContext;
}) {
  const parts = stepContent(id, brief, update, ctx);
  return <>{slot === 'ask' ? parts.ask : parts.options}</>;
}

function stepContent(
  id: StepId,
  brief: Brief,
  update: (patch: Partial<Brief>) => void,
  ctx: ContactContext,
): StepParts {
  switch (id) {
    case 'contact': {
      const name = cleanName(brief.contactName);
      return {
        ask: (
          <Ask
            title={name ? `${name}, where should we send your matches?` : 'Where should we send your matches?'}
            hint="Your number is how our expert reaches you to book your call. No studio sees it until you choose one."
          />
        ),
        options: (
          <ContactStep
            brief={brief}
            account={ctx.account}
            socialSignIn={ctx.socialSignIn}
            contact={ctx.contact}
            setContact={ctx.setContact}
            errors={ctx.errors}
          />
        ),
      };
    }
    case 'name':
      return nameStep(brief, update);
    case 'home':
      return homeStep(brief, update);
    case 'plan':
      return {
        ask: (
          <Ask
            title="Have your floor plan?"
            hint="The builder's plan, or a photo of it. We read the sizes off it so every studio's quote is priced on your actual kitchen and rooms — not a standard one. Skip it if you don't have it to hand."
          />
        ),
        options: <PlanReader brief={brief} update={update} />,
      };
    case 'possession':
      return possessionStep(brief, update);
    case 'scope':
      return scopeStep(brief, update);
    case 'level':
      return budgetStep(brief, update);
    case 'likes':
      return {
        ask: (
          <Ask
            title="Which of these feel like your home?"
            /* "Pick three" while Continue unlocked at one was a small lie that
               taught people the instructions here are approximate. Two or three
               is what the step actually accepts, so that is what it says. */
            hint="Pick two or three, on instinct. Don't overthink it — we'll tell you what you chose afterwards."
          />
        ),
        options: (
          <div>
            <SwipeOrGrid
              grid={
            <StylePicker
                  selected={brief.styleLikes}
                  max={3}
                  exclude={brief.styleDislikes}
                  photos={ctx.pickerPhotos}
                  room={pickerRoomFor(brief.scope, brief.scopeRooms)}
                  onChange={(styleLikes) =>
                    update({
                      styleLikes,
                      // Whose work they chose, for the tiles that were a studio's own photo.
                      styleStudioPicks: [
                        ...new Set(
                          styleLikes
                            .map((t) => ctx.pickerPhotos[t]?.studioId)
                            .filter((id): id is string => Boolean(id)),
                        ),
                      ],
                    })
                  }
                />
              }
              swipe={
                <SwipePicker
                  selected={brief.styleLikes}
                  exclude={brief.styleDislikes}
                  max={3}
                  room={pickerRoomFor(brief.scope, brief.scopeRooms)}
                  onChange={(styleLikes) => update({ styleLikes })}
                />
              }
            />
            {brief.styleLikes.length === 3 ? (
              <p className="mt-5 rounded-[10px] bg-[var(--acc-wash)] px-4 py-3 text-[15px] leading-relaxed text-[var(--ink2)]">
                So you lean{' '}
                <strong className="font-bold text-[var(--ink)]">
                  {brief.styleLikes.map((t) => STYLE_LABELS[t]).join(', ')}
                </strong>
                . That&rsquo;s the direction we&rsquo;ll match on.
              </p>
            ) : null}
            {brief.styleLikes.length >= 2 ? (
              <ThisOrThat
                key={brief.styleLikes.slice().sort().join(',')}
                likes={brief.styleLikes}
                dislikes={brief.styleDislikes}
                room={pickerRoomFor(brief.scope, brief.scopeRooms)}
                onDone={(styleLikes) => update({ styleLikes })}
              />
            ) : null}
            <InspirationReader
              likes={brief.styleLikes}
              dislikes={brief.styleDislikes}
              onUse={(styleLikes) => update({ styleLikes })}
            />
          </div>
        ),
      };
    case 'dislikes':
      return {
        ask: (
          <Ask
            title="And which two would you never want?"
            hint="Higher signal than what you like. Almost nobody asks this, and it rules studios out completely."
          />
        ),
        options: (
          <StylePicker
            selected={brief.styleDislikes}
            max={2}
            exclude={brief.styleLikes}
            tone="exclude"
            photos={ctx.pickerPhotos}
            room={pickerRoomFor(brief.scope, brief.scopeRooms)}
            onChange={(styleDislikes) => update({ styleDislikes })}
          />
        ),
      };
    case 'living':
      return livingStep(brief, update);
    case 'working':
      return workingStep(brief, update);
    case 'priorities':
      return priorityStep(brief, update);
  }
}

/**
 * The last screen: where to send their matches.
 *
 * Name (from the first screen), mobile, an optional email, and the notice.
 * The notice's words come from `PURPOSE_NOTICE`, the same object the consent
 * row records, so what they read and what we store cannot drift apart. The
 * WhatsApp line is separate, optional and unticked (DPDP: specific consent,
 * an affirmative act). Errors appear against the field they belong to;
 * Continue is never greyed out without saying why.
 */
function ContactStep({
  brief,
  account,
  socialSignIn,
  contact,
  setContact,
  errors,
}: {
  brief: Brief;
  account: { name: string | null; email: string | null } | null;
  socialSignIn: Providers;
  contact: ContactInput;
  setContact: (next: ContactInput) => void;
  errors: ContactErrors;
}) {
  const set = (patch: Partial<ContactInput>) => setContact({ ...contact, ...patch });

  /* Signed in — with Google or otherwise — fills the email and, if they
     skipped nothing, keeps the name they gave on screen one. Filled once, so
     it never overwrites something they have since typed. */
  useEffect(() => {
    if (account?.email && !contact.email) setContact({ ...contact, email: account.email });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [account?.email]);
  const field =
    'w-full rounded-full border bg-[var(--card)] px-5 py-3 text-[16px] text-[var(--ink)] placeholder:text-[var(--ink2)]';
  const border = (bad: boolean) => (bad ? 'border-[var(--acc)]' : 'border-[var(--line)]');
  const Err = ({ text }: { text?: string }) =>
    text ? <p className="m-0 mt-2 text-[13.5px] leading-snug text-[var(--acc-ink)]">{text}</p> : null;
  const name = contact.name || brief.contactName || '';

  return (
    <div className="flex max-w-lg flex-col gap-5">
      {/* One tap instead of typing, and the brief is kept on their account. No
          provider gives a phone number, so the mobile is still asked below. */}
      {account ? (
        <p className="m-0 text-[14px] text-[var(--ink2)]">
          Signed in{account.email ? ` as ${account.email}` : ''}. Your brief is saved to your account.
        </p>
      ) : anyProvider(socialSignIn) ? (
        <div className="flex flex-col gap-2 border-b border-[var(--line)] pb-5">
          <SocialButtons providers={socialSignIn} next="/quiz" className="max-w-xs" />
          <p className="m-0 text-[13px] leading-snug text-[var(--ink2)]">
            Fills in your name and email and keeps your brief on your account. We still need your
            mobile below.
          </p>
        </div>
      ) : null}

      <label className="block">
        <FieldLabel>Your name</FieldLabel>
        <input
          type="text"
          value={name}
          onChange={(e) => set({ name: e.target.value.slice(0, NAME_MAX) })}
          autoComplete="name"
          maxLength={NAME_MAX}
          className={`${field} ${border(!!errors.name)}`}
        />
        <Err text={errors.name} />
      </label>

      <label className="block">
        <FieldLabel>Mobile</FieldLabel>
        <input
          type="tel"
          inputMode="tel"
          value={contact.phone}
          onChange={(e) => set({ phone: e.target.value.slice(0, 20) })}
          placeholder="98765 43210"
          autoComplete="tel-national"
          className={`oi-num ${field} ${border(!!errors.phone)}`}
        />
        <Err text={errors.phone} />
      </label>

      <label className="block">
        <FieldLabel>Email, if you like</FieldLabel>
        <input
          type="email"
          inputMode="email"
          value={contact.email}
          onChange={(e) => set({ email: e.target.value.slice(0, 254) })}
          placeholder="you@example.com"
          autoComplete="email"
          className={`${field} ${border(!!errors.email)}`}
        />
        <Err text={errors.email} />
      </label>

      <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-5">
        <label className="flex cursor-pointer items-start gap-3 text-[14.5px] leading-relaxed text-[var(--ink)]">
          <input
            type="checkbox"
            checked={contact.agreed}
            onChange={(e) => set({ agreed: e.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--acc)]"
          />
          <span>
            {PURPOSE_NOTICE.DATA_PROCESSING.label}.{' '}
            <span className="text-[var(--ink2)]">{PURPOSE_NOTICE.DATA_PROCESSING.detail}</span>{' '}
            <Link href="/privacy" target="_blank" className="text-[var(--ink2)] underline">
              How we use it
            </Link>
          </span>
        </label>
        <Err text={errors.agreed} />

        <label className="flex cursor-pointer items-start gap-3 text-[14.5px] leading-relaxed text-[var(--ink2)]">
          <input
            type="checkbox"
            checked={contact.whatsappUpdates}
            onChange={(e) => set({ whatsappUpdates: e.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--acc)]"
          />
          <span>
            {PURPOSE_NOTICE.MARKETING_WHATSAPP.label} — optional.{' '}
            {PURPOSE_NOTICE.MARKETING_WHATSAPP.detail}
          </span>
        </label>
      </div>

      <Err text={errors.form} />
    </div>
  );
}

/**
 * The work: the scope, then exactly what it covers.
 *
 * The checklist is the quote. Every item listed is on every studio's first
 * quote; untick one and it leaves all of them, so the comparison stays like
 * for like. A single-room job and a renovation first ask which rooms.
 * Changing the scope clears the rooms and the unticked items — they belong to
 * the old scope's list.
 */
function scopeStep(brief: Brief, update: (p: Partial<Brief>) => void): StepParts {
  const bhk = BEDROOMS[brief.propertyType ?? 'BHK_2'];
  const selection = selectionOf(brief);
  const needsRooms = brief.scope === 'SINGLE_ROOM' || brief.scope === 'RENOVATION';
  const groups = brief.scope ? checklistFor(bhk, selection) : [];
  const off = new Set(brief.excludedItems);

  const toggleRoom = (room: string) =>
    update({
      scopeRooms: brief.scopeRooms.includes(room)
        ? brief.scopeRooms.filter((r) => r !== room)
        : [...brief.scopeRooms, room],
      excludedItems: [],
    });
  const toggleItem = (code: string) =>
    update({
      excludedItems: off.has(code)
        ? brief.excludedItems.filter((c) => c !== code)
        : [...brief.excludedItems, code],
    });

  return {
    ask: (
      <Ask
        title="How much of it are we doing?"
        hint="Then untick anything you don't want. Every studio is priced on exactly what is ticked."
      />
    ),
    options: (
      <div className="flex flex-col gap-7">
        <TileRow>
          {(Object.keys(SCOPE_LABELS) as ScopeType[]).map((k) => (
            <CircleTile
              key={k}
              label={SCOPE_LABELS[k]}
              Icon={SCOPE_ICONS[k]}
              selected={brief.scope === k}
              onClick={() => update({ scope: k, scopeRooms: [], excludedItems: [] })}
            />
          ))}
        </TileRow>

        {needsRooms ? (
          <div>
            <FieldLabel>
              {brief.scope === 'RENOVATION'
                ? 'Any rooms to redo as well as the civil work?'
                : 'Which rooms?'}
            </FieldLabel>
            <div className="flex flex-wrap gap-2">
              {roomsFor(bhk).map((room) => (
                <Chip key={room} selected={brief.scopeRooms.includes(room)} onClick={() => toggleRoom(room)}>
                  {ROOM_LABELS[room]}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        {groups.length > 0 ? (
          <div>
            <FieldLabel>What we will price — untick anything you don&rsquo;t want</FieldLabel>
            <div className="overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--card)]">
              {groups.map((g) => (
                <div key={g.room} className="border-b border-[var(--line)] px-4 py-3 last:border-b-0">
                  <p className="m-0 mb-2 text-[13px] font-medium text-[var(--ink)]">{g.label}</p>
                  <div className="flex flex-col gap-1.5">
                    {g.items.map((item) => (
                      <label
                        key={item.code}
                        className="flex cursor-pointer items-center gap-3 text-[14.5px] text-[var(--ink2)]"
                      >
                        <input
                          type="checkbox"
                          checked={!off.has(item.code)}
                          onChange={() => toggleItem(item.code)}
                          className="h-4 w-4 accent-[var(--acc)]"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    ),
  };
}

/**
 * Screen one: their name.
 *
 * First because it costs nothing and everything after it can speak to them —
 * the home question, the matches page ("Welcome, Sanyam"), the quotation
 * ("Prepared for Sanyam"). It stays in their tab until the contact step, where
 * it is sent with the number once they have agreed to the notice, and the hint
 * says exactly that.
 */
function nameStep(brief: Brief, update: (p: Partial<Brief>) => void): StepParts {
  return {
    ask: (
      <Ask
        title="First — what should we call you?"
        hint="Just a first name is fine. It stays on this device until you send us your brief at the end."
      />
    ),
    options: (
      <div className="max-w-md">
        <input
          type="text"
          value={brief.contactName ?? ''}
          onChange={(e) => update({ contactName: e.target.value.slice(0, NAME_MAX) })}
          placeholder="Your first name"
          aria-label="Your first name"
          autoComplete="given-name"
          autoCapitalize="words"
          maxLength={NAME_MAX}
          className="w-full rounded-full border border-[var(--line)] bg-[var(--card)] px-5 py-3.5 text-[17px] text-[var(--ink)] placeholder:text-[var(--ink2)]"
        />
      </div>
    ),
  };
}

/**
 * Screen two: the home, and where it is.
 *
 * The locality is a search now, not 64 chips — see `LocalityPicker`. The
 * society is optional free text: studios that have worked in the same
 * building know its layouts, and "they have done three flats in your
 * society" is the most checkable thing we will ever be able to say.
 *
 * The carpet area is not asked here since 30 Sep (build queue item 8): the
 * floor plan on the next screen gives it, and only a customer without one is
 * asked for it there (PlanReader).
 */
function homeStep(brief: Brief, update: (p: Partial<Brief>) => void): StepParts {
  const name = cleanName(brief.contactName);

  return {
    ask: (
      <Ask
        title={name ? `${name}, what kind of home are we working with?` : 'What kind of home are we working with?'}
        hint="And where in Pune it is, so we only show you studios who actually work there."
      />
    ),
    options: (
      <div className="flex flex-col gap-6">
        <TileRow>
          {(Object.keys(PROPERTY_LABELS) as PropertyType[]).map((k) => (
            <CircleTile
              key={k}
              label={PROPERTY_LABELS[k]}
              Icon={PROPERTY_ICONS[k]}
              selected={brief.propertyType === k}
              onClick={() => update({ propertyType: k })}
            />
          ))}
        </TileRow>

        <div>
          <FieldLabel>Where is it?</FieldLabel>
          {/* Keyed on the value so a locality filled from the society collapses the picker. */}
          <LocalityPicker
            key={brief.locality ?? 'none'}
            value={brief.locality}
            onChange={(locality) => update({ locality })}
          />
        </div>

        <label className="block sm:max-w-[26rem]">
          <FieldLabel>Society or building, if you like</FieldLabel>
          <SocietyInput
            value={brief.society}
            onChange={(society) => update({ society })}
            onPick={(s) => update({ society: s.name, locality: s.locality })}
          />
        </label>
      </div>
    ),
  };
}

/** Who lives there, and what the home needs. */
function livingStep(brief: Brief, update: (p: Partial<Brief>) => void): StepParts {
  const household = householdStep(brief, update);
  const toggle = (need: HomeNeed) =>
    update({
      needs: brief.needs.includes(need)
        ? brief.needs.filter((n) => n !== need)
        : [...brief.needs, need],
    });

  return {
    ask: household.ask,
    options: (
      <div className="flex flex-col gap-7">
        {household.options}
        <div>
          <FieldLabel>Anything the home needs? Pick any that apply</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {HOME_NEEDS.map((need) => (
              <Chip key={need} selected={brief.needs.includes(need)} onClick={() => toggle(need)}>
                {HOME_NEED_LABELS[need]}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    ),
  };
}

/** How involved they want to be, and the language they want to work in. */
function workingStep(brief: Brief, update: (p: Partial<Brief>) => void): StepParts {
  return {
    ask: (
      <Ask
        title="How involved do you want to be?"
        hint="The most common reason a project goes wrong is a mismatch here — not a mismatch in taste."
      />
    ),
    options: (
      <div className="flex flex-col gap-7">
        <TileRow>
          {(Object.keys(INVOLVEMENT_LABELS) as Involvement[]).map((k) => (
            <CircleTile
              key={k}
              label={INVOLVEMENT_LABELS[k]}
              Icon={INVOLVEMENT_ICONS[k]}
              selected={brief.involvement === k}
              onClick={() => update({ involvement: k })}
            />
          ))}
        </TileRow>
        <div>
          <FieldLabel>The language you&rsquo;d like your studio to speak</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <Chip
                key={lang}
                selected={brief.language === lang}
                onClick={() => update({ language: brief.language === lang ? null : lang })}
              >
                {LANGUAGE_LABELS[lang]}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    ),
  };
}


/**
 * Budget and finish level, as one question.
 *
 * ## Why these used to be two steps, and why that was wrong
 *
 * The quiz asked for a budget on a slider, and then a separate `/tier` screen
 * asked the customer to choose Essential, Premium or Luxury. Those are the same
 * question asked twice: a band IS a budget, and a budget already implies a
 * band. Answering it once, with real numbers attached, is strictly more
 * informative and one screen shorter.
 *
 * ## Why bands rather than a slider
 *
 * A slider asks "what number is in your head", which most people genuinely do
 * not know before anyone has quoted them — it is the whole reason they are
 * here. Three bands priced for *their* carpet area asks a question they can
 * actually answer: given what each level of finish costs for a home this size,
 * which one do you want to be in?
 *
 * The `notFor` line on each card is doing real work. Naming what a band cannot
 * deliver kills an unqualified expectation here, which is far cheaper for
 * everyone than killing it at the quotation.
 */
function budgetStep(brief: Brief, update: (p: Partial<Brief>) => void): StepParts {
  const { sqft: area, assumed: areaAssumed } = carpetAreaFor(brief);
  const shape = homeShapeFor(brief);
  const selection = selectionOf(brief);
  const partial = brief.scope !== null && (brief.scope !== 'FULL_HOME' || brief.excludedItems.length > 0);

  return {
    ask: (
      <Ask
        title="What are you planning to spend?"
        hint="Priced for a home your size, at three levels of finish. It isn't a commitment — it stops us showing you studios who don't work at your level."
      />
    ),
    options: (
      <div className="flex flex-col gap-3">
        {TIERS.map((tier) => {
          const definition = TIER[tier];
          // The budget kept on the brief is the band for the WHOLE home — it is
          // the studio's price level, and matching compares like with like.
          // What is shown is that band for their scope (see scope-band.ts).
          const { lowPaise, highPaise } = tierRangeFor(tier, area);
          const shown = partial ? scopeBandRange(tier, shape, selection) : { lowPaise, highPaise };
          const selected = brief.tier === tier;

          return (
            <button
              key={tier}
              type="button"
              onClick={() =>
                update({
                  tier,
                  // The band is the budget. Both are set from one tap so
                  // nothing downstream has to guess which one the customer
                  // really meant.
                  budgetMinPaise: lowPaise,
                  budgetMaxPaise: highPaise,
                })
              }
              aria-pressed={selected}
              className={`rounded-[14px] border-2 p-5 text-left transition-colors ${
                selected
                  ? 'border-[var(--acc)] bg-[var(--acc-wash)]'
                  : 'border-[var(--line)] bg-[var(--card)] hover:border-[var(--ink2)]'
              }`}
            >
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="oi-display text-[21px] leading-none text-[var(--ink)]">
                  {definition.label}
                </span>
                <span className="oi-num oi-display text-[19px] leading-none text-[var(--acc-ink)]">
                  {shown === null
                    ? perSqftLabel(tier) + ' / sq ft'
                    : shown.highPaise === null
                      ? `From ${formatINRCompact(shown.lowPaise)}`
                      : `${formatINRCompact(shown.lowPaise)} – ${formatINRCompact(shown.highPaise)}`}
                </span>
              </div>
              <p className="m-0 text-[14.5px] leading-[1.5] text-[var(--ink2)]">
                {definition.promise}
              </p>
              {selected ? (
                <p className="m-0 mt-2.5 border-t border-[var(--line)] pt-2.5 text-[13px] leading-[1.5] text-[var(--ink2)]">
                  {definition.notFor}
                </p>
              ) : null}
            </button>
          );
        })}

        {partial ? (
          <p className="m-0 mt-1 text-[13px] leading-[1.55] text-[var(--ink2)]">
            {scopeShare(shape, selection) === null
              ? 'We cannot put a range on civil work yet — each studio prices it on its own rates, and your quotes show it line by line. The level is what they charge per square foot of a home.'
              : `For ${scopePhrase(selection)?.toLowerCase() ?? 'your scope'} — the level's price for your home, scaled to the part you are doing.`}
          </p>
        ) : null}
        <p className="m-0 mt-1 text-[13px] leading-[1.55] text-[var(--ink2)]">
          {areaAssumed
            ? `Excluding GST, for a typical ${area.toLocaleString('en-IN')} sq ft ${
                brief.propertyType ? PROPERTY_LABELS[brief.propertyType] : 'home'
              } — tell us your carpet area and these tighten.`
            : // Derived, not written as a constant (FINDINGS 1.1): until studios'
              // own filed rates are live, "their own rates" would be false.
              `Excluding GST, for your ${area} sqft. ${
                ratesAreReal()
                  ? "Your real quotes come from each studio's own rates."
                  : 'Your quotes follow, line by line.'
              }`}
        </p>
      </div>
    ),
  };
}

/**
 * Q9 — possession, not move-in.
 *
 * Three answers, because those are the three situations people are actually
 * in. "Expecting it" opens a month field: a studio can plan design around a
 * month, and nobody knows their handover to the day.
 *
 * The line under the choice is the timeline this answer buys them — for a
 * full home only, because 70–130 days is the one duration we have evidence
 * for (see `modules/brief/possession.ts`). The old Q9 promised "we'll say so"
 * about a tight date and never did; this says only what it can back.
 */
function possessionStep(brief: Brief, update: (p: Partial<Brief>) => void): StepParts {
  const status = brief.possessionStatus;
  const window = readyWindow(status, brief.possessionOn, brief.scope);
  const monthValue = brief.possessionOn ? brief.possessionOn.slice(0, 7) : '';
  const short = (d: Date) =>
    d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const option = (value: PossessionStatus, body: string) => {
    const selected = status === value;
    return (
      <button
        key={value}
        type="button"
        aria-pressed={selected}
        onClick={() =>
          update({
            possessionStatus: value,
            // A month only means something when they are expecting the keys.
            possessionOn: value === 'EXPECTED' ? brief.possessionOn : null,
          })
        }
        className={`rounded-[14px] border-2 p-5 text-left transition-colors ${
          selected
            ? 'border-[var(--acc)] bg-[var(--acc-wash)]'
            : 'border-[var(--line)] bg-[var(--card)] hover:border-[var(--ink2)]'
        }`}
      >
        <span className="oi-display block text-[21px] leading-none text-[var(--ink)]">
          {POSSESSION_LABELS[value]}
        </span>
        <span className="mt-1.5 block text-[14.5px] leading-[1.5] text-[var(--ink2)]">{body}</span>
      </button>
    );
  };

  return {
    ask: (
      <Ask
        title="Last one — do you have possession yet?"
        hint="Work starts from the day you get the keys, so everything we plan counts from there."
      />
    ),
    options: (
      <div className="flex flex-col gap-3">
        {option('HAVE_KEYS', 'Work can start as soon as the design is signed off.')}
        {option('EXPECTED', 'Tell us the month. Design can start before handover.')}
        {status === 'EXPECTED' ? (
          <label className="-mt-1 ml-1 flex flex-wrap items-center gap-3">
            <span className="text-[14px] text-[var(--ink2)]">Possession expected in</span>
            <input
              type="month"
              value={monthValue}
              onChange={(e) =>
                update({ possessionOn: e.target.value ? `${e.target.value}-01` : null })
              }
              className="oi-num rounded-full border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 text-[15px] text-[var(--ink)]"
            />
          </label>
        ) : null}
        {option('NOT_SURE', 'That is fine — we will plan from when you know.')}

        {window ? (
          <p className="m-0 mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-[var(--ink2)]">
            A full home in Pune usually takes {FULL_HOME_DAYS.min} to {FULL_HOME_DAYS.max} days from
            design sign-off. With the design signed off by{' '}
            {status === 'HAVE_KEYS' ? 'now' : 'the time you get the keys'}, yours could be ready
            between <strong className="text-[var(--ink)]">{short(window.from)}</strong> and{' '}
            <strong className="text-[var(--ink)]">{short(window.to)}</strong>.
          </p>
        ) : null}
      </div>
    ),
  };
}

function householdStep(brief: Brief, update: (p: Partial<Brief>) => void): StepParts {
  const h = brief.household ?? {
    adults: 2,
    children: 0,
    elderly: 0,
    pets: false,
    worksFromHome: false,
  };
  const set = (patch: Partial<typeof h>) => update({ household: { ...h, ...patch } });

  return {
    ask: (
      <Ask
        title="Who's going to live there?"
        hint="Your studio sees this before your first meeting, so the design starts from how you actually live."
      />
    ),
    options: (
      <div className="flex max-w-lg flex-col gap-4">
        <Counter
          label="Adults"
          Icon={IconAdults}
          value={h.adults}
          onChange={(adults) => set({ adults })}
          min={1}
        />
        <Counter
          label="Children"
          Icon={IconChildren}
          value={h.children}
          onChange={(children) => set({ children })}
        />
        <Counter
          label="Parents / elderly"
          Icon={IconElderly}
          value={h.elderly}
          onChange={(elderly) => set({ elderly })}
        />

        <div className="mt-1 flex flex-wrap gap-2">
          <Chip selected={h.pets} onClick={() => set({ pets: !h.pets })} Icon={IconPets}>
            Pets
          </Chip>
          <Chip
            selected={h.worksFromHome}
            onClick={() => set({ worksFromHome: !h.worksFromHome })}
            Icon={IconWork}
          >
            Someone works from home
          </Chip>
        </div>
      </div>
    ),
  };
}

function priorityStep(brief: Brief, update: (p: Partial<Brief>) => void): StepParts {
  const ranked = brief.priorityRanking;
  const remaining = (Object.keys(PRIORITY_LABELS) as PriorityFactor[]).filter(
    (k) => !ranked.includes(k),
  );

  return {
    ask: (
      /* The heading and the hint used to point in OPPOSITE directions.
         "If you had to give one of these up, which goes first?" asks for the
         LEAST important thing. "Tap them in order, most important first" asks
         for the most. A reader who trusted the heading ranked the list
         backwards — and `priorityRanking[0]` is treated everywhere as the
         thing that matters most, so that answer silently inverted the single
         largest input to the matching engine. Nobody would ever have seen it
         go wrong: the customer gets confidently ranked studios that suit the
         opposite of what they said.

         Both lines now ask the same question, in the same direction. */
      <Ask
        title="What matters most to you here?"
        hint="Tap them in order, starting with the most important. Your first choice gets extra weight when we rank studios."
      />
    ),
    options: (
      <div className="flex max-w-lg flex-col gap-2.5">
        {ranked.map((k, i) => {
          const Icon = PRIORITY_ICONS[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => update({ priorityRanking: ranked.filter((r) => r !== k) })}
              /* Without this the accessibility tree shows four unlabelled
                 buttons: the visible text sits in nested spans alongside a rank
                 number and the word "Remove", which do not compose into a
                 usable name. A screen reader user was being asked to rank four
                 things called "button". */
              aria-label={`${PRIORITY_LABELS[k]} — ranked ${i + 1}. Tap to remove from the ranking.`}
              className="flex items-center gap-3 rounded-full border-2 border-[var(--acc)] bg-[var(--acc-wash)] px-4 py-3 text-left text-[15px] text-[var(--ink)]"
            >
              <span className="oi-num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--acc-ink)] oi-num text-[11px] text-white">
                {i + 1}
              </span>
              <Icon className="h-6 w-6 shrink-0 text-[var(--acc-ink)]" />
              <span className="flex-1">{PRIORITY_LABELS[k]}</span>
              <span className="oi-label m-0">Remove</span>
            </button>
          );
        })}
        {remaining.map((k) => {
          const Icon = PRIORITY_ICONS[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => update({ priorityRanking: [...ranked, k] })}
              aria-label={`${PRIORITY_LABELS[k]} — tap to rank it ${ranked.length + 1}.`}
              className="flex items-center gap-3 rounded-full border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-left text-[15px] text-[var(--ink2)] transition-colors hover:border-[var(--acc)]"
            >
              <span className="h-6 w-6 shrink-0" />
              <Icon className="h-6 w-6 shrink-0 text-[var(--ink2)]" />
              <span>{PRIORITY_LABELS[k]}</span>
            </button>
          );
        })}
      </div>
    ),
  };
}

/**
 * The running confirmation. This is what makes the quiz feel like it is
 * listening rather than collecting — the user watches their own brief assemble
 * itself, and the studio count move, as they answer. It is the strongest
 * anti-dropout device in the flow, which is why it sits beside the question
 * rather than below the fold.
 */
function LiveProfile({
  brief,
  className = '',
  bare = false,
}: {
  brief: Brief;
  className?: string;
  /** Inside the phone disclosure, which already draws the border. */
  bare?: boolean;
}) {
  const rows: Array<[string, string]> = [];

  if (brief.propertyType) {
    const loc = localityLabel(brief.locality);
    rows.push(['Home', `${PROPERTY_LABELS[brief.propertyType]}${loc ? ` · ${loc}` : ''}`]);
    const society = brief.society?.trim();
    if (society) rows.push(['Society', society]);
  }
  if (brief.scope) {
    const phrase = scopePhrase(selectionOf(brief)) ?? SCOPE_LABELS[brief.scope];
    const off = brief.excludedItems.length;
    rows.push(['Scope', off ? `${phrase} · ${off} left out` : phrase]);
  }
  if (brief.budgetMinPaise) {
    rows.push([
      'Budget',
      // The top band has no ceiling, so it is a floor, not a range.
      brief.budgetMaxPaise
        ? `${formatINRCompact(brief.budgetMinPaise)} – ${formatINRCompact(brief.budgetMaxPaise)}`
        : `From ${formatINRCompact(brief.budgetMinPaise)}`,
    ]);
  }
  if (brief.styleLikes.length) {
    rows.push(['Leaning', brief.styleLikes.map((t) => STYLE_LABELS[t]).join(', ')]);
  }
  if (brief.styleDislikes.length) {
    rows.push(['Ruled out', brief.styleDislikes.map((t) => STYLE_LABELS[t]).join(', ')]);
  }
  if (brief.household) {
    const h = brief.household;
    const parts = [`${h.adults} adult${h.adults === 1 ? '' : 's'}`];
    if (h.children) parts.push(`${h.children} child${h.children === 1 ? '' : 'ren'}`);
    if (h.elderly) parts.push(`${h.elderly} elderly`);
    if (h.pets) parts.push('pets');
    if (h.worksFromHome) parts.push('WFH');
    rows.push(['Household', parts.join(', ')]);
  }
  if (brief.priorityRanking.length) {
    rows.push(['Priority', PRIORITY_LABELS[brief.priorityRanking[0]]]);
  }
  if (brief.needs.length) rows.push(['Needs', brief.needs.map((n) => HOME_NEED_LABELS[n]).join(', ')]);
  if (brief.involvement) rows.push(['Working style', INVOLVEMENT_LABELS[brief.involvement]]);
  {
    const possession = possessionPhrase(brief);
    if (possession) rows.push(['Possession', possession]);
  }

  return (
    <Sheet
      as="section"
      className={bare ? `border-0 bg-transparent ${className}` : `p-5 ${className}`}
    >
      <p className="oi-label m-0 mb-4">
        {cleanName(brief.contactName) ? `${cleanName(brief.contactName)}'s brief so far` : 'Your brief so far'}
      </p>

      {rows.length === 0 ? (
        <p className="m-0 text-[14px] text-[var(--ink2)]">
          This fills in as you answer. Nothing is sent anywhere while you do.
        </p>
      ) : (
        <div className="m-0">
          {rows.map(([k, v]) => (
            <DocRow key={k} label={k} value={v.toUpperCase()} />
          ))}
        </div>
      )}

      {/* Their home, assembling as they answer (queue item 26). It took the
          place of the "N studios still match" counter: before the answers
          narrow anything, that number is the size of the roster, which the
          owner is not showing until it is fifty. */}
      <div className="mt-5 border-t border-[var(--ink)] pt-4">
        <HomeSketch brief={brief} />
      </div>
    </Sheet>
  );
}

// ── Primitives ─────────────────────────────────────────────────

function Ask({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="lg:pt-4">
      <h1 className="h1 mb-4 max-w-[16ch]">{title}</h1>
      {hint ? <p className="m-0 max-w-[42ch] text-[16px] leading-relaxed text-[var(--ink2)]">{hint}</p> : null}
    </div>
  );
}

function TileRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-3 sm:gap-4">{children}</div>;
}

/**
 * The circular option tile. Soft ground, thin line icon, label below the icon
 * inside the circle. Selection is a ring plus a tick — shape as well as colour.
 */
function CircleTile({
  label,
  Icon,
  selected,
  onClick,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      /* Fixed at 122px. The tile used to grow to 136 at the `sm` breakpoint,
         which is where it started costing more than it gained: five tiles at
         136 plus gaps need ~744px, so on any window between roughly 640 and
         1024 the fifth tile wrapped onto a second row and pushed the locality
         chips — the field that actually unlocks Continue — below the fold.
         Twelve pixels of tile is not worth a hidden required field.

         100px on a phone for the same reason: at 122 a 375px screen fits two
         a row, so the five home types took three rows and pushed "Where is
         it?" — the field that unlocks Continue — off the first screen. At 100
         they fit three a row. */
      className={`relative flex h-[100px] w-[100px] shrink-0 flex-col items-center justify-center gap-1 rounded-full px-2.5 text-center transition-all sm:h-[122px] sm:w-[122px] sm:gap-1.5 sm:px-3 ${
        selected
          ? 'bg-[var(--acc-wash)] ring-2 ring-[var(--acc)]'
          : 'bg-[var(--card)] hover:bg-[var(--line)]'
      }`}
    >
      <Icon
        className={`h-8 w-8 sm:h-10 sm:w-10 ${selected ? 'text-[var(--acc-ink)]' : 'text-[var(--ink2)]'}`}
      />
      <span className="text-[12px] leading-tight text-[var(--ink2)] sm:text-[12.5px]">{label}</span>
      {selected ? (
        <span
          className="absolute right-3 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--acc-ink)] text-[11px] leading-none text-white"
          aria-hidden="true"
        >
          ✓
        </span>
      ) : null}
    </button>
  );
}

function Chip({
  children,
  selected,
  onClick,
  Icon,
}: {
  children: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  Icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[14.5px] transition-colors ${
        selected
          ? 'border-[var(--acc)] bg-[var(--acc-wash)] text-[var(--ink)]'
          : 'border-[var(--line)] bg-[var(--card)] text-[var(--ink2)] hover:border-[var(--ink2)]'
      }`}
    >
      {Icon ? <Icon className="h-5 w-5" /> : null}
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 mb-3 oi-num text-[10px] uppercase tracking-[0.13em] text-[var(--ink2)]">
      {children}
    </p>
  );
}

function Counter({
  label,
  value,
  onChange,
  min = 0,
  Icon,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-full bg-[var(--card)] py-2.5 pl-5 pr-2.5">
      <span className="flex items-center gap-3 text-[15px] text-[var(--ink)]">
        <Icon className="h-6 w-6 text-[var(--ink2)]" />
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Decrease ${label}`}
          className="h-9 w-9 rounded-full border border-[var(--line)] bg-[var(--bg)] text-[18px] leading-none text-[var(--ink2)] transition-colors hover:border-[var(--acc)]"
        >
          −
        </button>
        <span className="oi-num w-6 text-center text-[16px]">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
          className="h-9 w-9 rounded-full border border-[var(--line)] bg-[var(--bg)] text-[18px] leading-none text-[var(--ink2)] transition-colors hover:border-[var(--acc)]"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Style picker. Names stay hidden until a tile is chosen — the customer picks on
 * instinct, then we name it. That reveal is how the quiz teaches vocabulary to
 * someone who arrived without it.
 */
function StylePicker({
  selected,
  max,
  exclude,
  onChange,
  tone = 'include',
  photos: studioPhotos = {},
  room = 'LIVING',
}: {
  selected: StyleTag[];
  max: number;
  exclude: StyleTag[];
  onChange: (tags: StyleTag[]) => void;
  tone?: 'include' | 'exclude';
  /** A studio's own photo for a style, used in place of the stock one. */
  photos?: Partial<Record<StyleTag, PickerPhoto>>;
  /** Scope-aware: kitchens for a kitchen job, bedrooms for a bedrooms-only job. */
  room?: PickerRoom;
}) {
  // Studio photos lead with living rooms, so they stand in only where living rooms are shown.
  const photos = room === 'LIVING' ? studioPhotos : {};
  function toggle(tag: StyleTag) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else if (selected.length < max) {
      onChange([...selected, tag]);
    }
  }

  const ring =
    tone === 'exclude' ? 'ring-2 ring-[var(--acc-ink)]' : 'ring-2 ring-[var(--acc)]';

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STYLE_TAGS.map((tag, i) => {
          const isSelected = selected.includes(tag);
          const isBlocked = exclude.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              disabled={isBlocked}
              onClick={() => toggle(tag)}
              aria-pressed={isSelected}
              aria-label={isSelected ? STYLE_LABELS[tag] : `Room option ${i + 1}`}
              className={`lift relative overflow-hidden rounded-[10px] text-left disabled:cursor-not-allowed disabled:opacity-25 ${
                isSelected ? ring : ''
              }`}
            >
              {photos[tag] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photos[tag]!.src}
                  alt={photos[tag]!.alt}
                  loading={i < 6 ? 'eager' : 'lazy'}
                  className="block aspect-[4/3] w-full object-cover"
                />
              ) : STYLE_PHOTOS[tag] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stylePhotoUrl(stylePhotoFor(tag, room))}
                  srcSet={`${stylePhotoUrl(stylePhotoFor(tag, room), 400)} 400w, ${stylePhotoUrl(stylePhotoFor(tag, room), 800)} 800w`}
                  sizes="(min-width: 640px) 33vw, 50vw"
                  /* Named only after it is picked — the alt describes the room,
                     never the style, so a screen reader is not told the answer. */
                  alt={stylePhotoFor(tag, room).alt}
                  loading={i < 6 ? 'eager' : 'lazy'}
                  className="block aspect-[4/3] w-full object-cover"
                />
              ) : (
                <StyleScene tag={tag} className="block aspect-[4/3] w-full" />
              )}
              <span
                className={`block bg-[var(--card)] px-3 py-2 text-[12.5px] ${
                  isSelected ? 'font-bold text-[var(--ink)]' : 'text-[var(--ink2)]'
                }`}
              >
                {isSelected ? STYLE_LABELS[tag] : isBlocked ? 'Already picked' : `Room ${i + 1}`}
              </span>
              {isSelected ? (
                <span
                  className={`absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] leading-none text-white ${
                    tone === 'exclude' ? 'bg-[var(--acc-ink)]' : 'bg-[var(--acc)]'
                  }`}
                  aria-hidden="true"
                >
                  {tone === 'exclude' ? '✕' : '✓'}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="m-0 oi-num text-[11px] uppercase tracking-[0.1em] text-[var(--ink2)]">
          {selected.length} of {max} selected
        </p>
        <details className="text-[11.5px] text-[var(--ink2)]">
          <summary className="cursor-pointer">Photo credits</summary>
          <p className="m-0 mt-1 max-w-[60ch] leading-relaxed">
            {Object.keys(photos).length > 0
              ? 'Some are finished homes by studios on One Interiors, shown with their permission and without their names. '
              : ''}
            Photographs from Unsplash by{' '}
            {[
              ...new Set(
                STYLE_TAGS.filter((t) => !photos[t]).map((t) => stylePhotoFor(t, room).photographer).filter(Boolean),
              ),
            ].join(', ')}
            .
          </p>
        </details>
        {selected.length > 0 && tone === 'include' ? (
          <MaterialSwatches tag={selected[selected.length - 1]} />
        ) : null}
      </div>
    </>
  );
}

// ── Validation ─────────────────────────────────────────────────

