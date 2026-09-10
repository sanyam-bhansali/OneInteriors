'use client';

/**
 * The 9-question brief.
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
 *  3. No phone number until after the reveal. Progressive commitment: never ask
 *     for more than the customer has earned reason to give.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container, Button } from '@/components/ui';
import { formatINRCompact, lakhsToPaise, applyBps } from '@/lib/money';
import {
  EMPTY_BRIEF,
  INVOLVEMENT_LABELS,
  PRIORITY_LABELS,
  PROPERTY_LABELS,
  PUNE_LOCALITIES,
  SCOPE_LABELS,
  STYLE_LABELS,
  STYLE_TAGS,
  TOTAL_STEPS,
  type Brief,
  type Involvement,
  type PriorityFactor,
  type PropertyType,
  type ScopeType,
  type StyleTag,
} from '@/modules/brief/types';
import { loadBrief, saveBrief } from '@/modules/brief/store';
import {
  saveBriefAction,
  loadBriefAction,
  trackAction,
} from './actions';
import { rankStudios } from '@/modules/matching/score';
import type { Studio } from '@/modules/studio/types';
import { StyleScene, MaterialSwatches } from '@/components/art/StyleScene';
import { Wordmark } from '@/components/brand';
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
  return `about ${Math.ceil(seconds / 60)} minutes left`;
}

export function QuizClient({ studios }: { studios: Studio[] }) {
  const router = useRouter();
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [step, setStep] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  /** True between the last answer and the tier page. Keeps the button honest. */
  const [finishing, setFinishing] = useState(false);

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
        setBrief(remote);
        saveBrief(remote);
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
    void saveBriefAction(next).catch(() => {});
  }

  function next() {
    void trackAction('quiz.step.complete', { step });

    if (step >= TOTAL_STEPS) {
      const done = { ...brief, completedAt: new Date().toISOString(), lastStep: TOTAL_STEPS };
      saveBrief(done);
      void trackAction('quiz.complete');

      /**
       * The one sync that is waited on.
       *
       * Every other write is fire-and-forget so Continue never feels slow. This
       * one is different: it carries `completedAt`, and every server-rendered
       * step after this point refuses to work without it. Racing the navigation
       * against it means the customer can reach the quote step before the row
       * says their brief is finished.
       *
       * Waited on, but never blocking: a second, then we move regardless.
       * BriefRescue picks up whatever did not land, so the worst case is a
       * short "picking up your brief" rather than a stall here.
       */
      setFinishing(true);
      void Promise.race([
        saveBriefAction(done).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]).then(() => router.push('/tier'));
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

  const canAdvance = isStepAnswered(brief, step);

  const matchCount = useMemo(() => {
    if (!hydrated) return studios.length;
    return rankStudios(brief, studios, 99).length;
  }, [brief, hydrated, studios]);

  if (!hydrated) {
    return (
      <main className="py-16">
        <Container size="narrow">
          <p className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
            Loading…
          </p>
        </Container>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--color-paper)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
        <Container size="wide">
          <div className="flex items-center justify-between gap-4 py-3.5">
            <Link href="/" className="no-underline" aria-label="One Interiors, home">
              <Wordmark showCity={false} />
            </Link>
            {/* Time left, not a count.
                "Question 3 of 9" answers a question nobody asked. What someone
                deciding whether to keep going actually wants to know is how
                much longer this is — and an honest estimate is far more
                motivating than an index. Calibrated at roughly twenty seconds
                a question, which is what the nine-in-three-minutes promise on
                the landing page implies, so the two cannot contradict. */}
            <span className="tabular label m-0">
              {step} of {TOTAL_STEPS} · {minutesLeft(step)}
            </span>
          </div>
        </Container>
        <div
          className="h-[3px] w-full bg-[var(--color-paper-3)]"
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
        >
          {/* The bar never starts empty.
                A zero-width bar on question one reads as "you have done
                nothing", which is both discouraging and untrue — they have
                already decided to start, which is the hardest step. The floor
                is a visual minimum only: the number of questions left is stated
                in words right above it, so nothing here overstates progress. */}
          <div
            className="h-full bg-[var(--color-petrol)] transition-all duration-500 ease-out"
            style={{ width: `${Math.max(7, (step / TOTAL_STEPS) * 100)}%` }}
          />
        </div>
      </header>

      {/* A fixed three-part frame: header, a scrolling question area, and a
          footer that never leaves the viewport.

          The first build put Continue after the options AND after the running
          profile panel, so answering a question meant scrolling down to find
          the button — on every one of the nine. A quiz where the primary
          action is below the fold reads as broken, however good the question
          above it is. */}
      <main ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <Container size="wide">
          <div className="grid grid-cols-1 gap-9 py-8 sm:py-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
            <div key={`q-${step}`} className="rise flex flex-col gap-7">
              <QuestionStep step={step} brief={brief} update={update} slot="ask" />
              <LiveProfile brief={brief} matchCount={matchCount} className="hidden lg:block" />
            </div>

            <div key={`o-${step}`} className="rise rise-1 min-w-0">
              <QuestionStep step={step} brief={brief} update={update} slot="options" />

              {/* On a phone the panel is COLLAPSED by default.
                  It is reassurance, not information the customer needs to
                  answer the question in front of them — and expanded it pushed
                  the options down far enough that the question and its answers
                  no longer shared a screen. Available in one tap for anyone who
                  wants to check what we have understood so far; out of the way
                  for everyone else. On a laptop it stays open in the left
                  column, where it costs no vertical space at all. */}
              <details className="group mt-7 rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                    What we have so far
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-petrol)] group-open:hidden">
                    Show
                  </span>
                  <span className="hidden font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-petrol)] group-open:inline">
                    Hide
                  </span>
                </summary>
                <div className="border-t border-[var(--color-rule)] p-4">
                  <LiveProfile brief={brief} matchCount={matchCount} />
                </div>
              </details>
            </div>
          </div>
        </Container>
      </main>

      <footer className="sticky bottom-0 z-10 border-t border-[var(--color-rule)] bg-[var(--color-paper)]/95 backdrop-blur">
        <Container size="wide">
          <div className="flex items-center justify-between gap-4 py-4">
            <Button variant="secondary" onClick={back}>
              Back
            </Button>

            <div className="flex items-center gap-4">
              {!canAdvance ? (
                <span className="hidden text-[13.5px] text-[var(--color-ink-3)] sm:inline">
                  Pick an answer to continue
                </span>
              ) : null}
              <Button onClick={next} disabled={!canAdvance || finishing} size="lg">
                {finishing
                  ? 'Saving your brief…'
                  : step === TOTAL_STEPS
                    ? 'See what it costs'
                    : 'Continue'}
              </Button>
            </div>
          </div>
        </Container>
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

function QuestionStep({
  step,
  brief,
  update,
  slot,
}: {
  step: number;
  brief: Brief;
  update: (patch: Partial<Brief>) => void;
  slot: 'ask' | 'options';
}) {
  const parts = stepContent(step, brief, update);
  if (!parts) return null;
  return <>{slot === 'ask' ? parts.ask : parts.options}</>;
}

function stepContent(
  step: number,
  brief: Brief,
  update: (patch: Partial<Brief>) => void,
): StepParts | null {
  switch (step) {
    case 1:
      return {
        ask: (
          <Ask
            title="First — what kind of home are we working with?"
            hint="And where in Pune it is, so we only show you studios who actually work there."
          />
        ),
        options: (
          /* Tighter than the other steps on purpose.
             This is the only question carrying three fields, and Continue does
             not unlock until locality is answered — so if locality sits below
             the fold, the very first screen of the funnel looks like a dead
             button. It was doing exactly that on anything shorter than a
             full-height laptop window. The gaps here are the difference
             between all three fields fitting and not. */
          <div className="flex flex-col gap-5 sm:gap-6">
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
              <FieldLabel>Locality</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {PUNE_LOCALITIES.map((l) => (
                  <Chip
                    key={l.slug}
                    selected={brief.locality === l.slug}
                    onClick={() => update({ locality: l.slug })}
                  >
                    {l.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>Carpet area, if you know it</FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="980"
                  value={brief.carpetAreaSqft ?? ''}
                  onChange={(e) =>
                    update({ carpetAreaSqft: e.target.value ? Number(e.target.value) : null })
                  }
                  className="tabular w-32 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-2.5 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)]"
                />
                <span className="text-[14px] text-[var(--color-ink-3)]">sq ft</span>
              </div>
            </div>
          </div>
        ),
      };

    case 2:
      return {
        ask: (
          <Ask
            title="How much of it are we doing?"
            hint="You can widen this later with your studio — nothing here is fixed."
          />
        ),
        options: (
          <TileRow>
            {(Object.keys(SCOPE_LABELS) as ScopeType[]).map((k) => (
              <CircleTile
                key={k}
                label={SCOPE_LABELS[k]}
                Icon={SCOPE_ICONS[k]}
                selected={brief.scope === k}
                onClick={() => update({ scope: k })}
              />
            ))}
          </TileRow>
        ),
      };

    case 3:
      return budgetStep(brief, update);

    case 4:
      return {
        ask: (
          <Ask
            title="Which of these feel like your home?"
            // "Pick three" while Continue unlocked at one was a small lie that
            // taught people the instructions here are approximate. Two or
            // three is what the step actually accepts, so that is what it says.
            hint="Pick two or three, on instinct. Don't overthink it — we'll tell you what you chose afterwards."
          />
        ),
        options: (
          <div>
            <StylePicker
              selected={brief.styleLikes}
              max={3}
              exclude={brief.styleDislikes}
              onChange={(styleLikes) => update({ styleLikes })}
            />
            {brief.styleLikes.length === 3 ? (
              <p className="mt-5 rounded-[10px] bg-[var(--color-terracotta-soft)] px-4 py-3 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
                So you lean{' '}
                <strong className="font-bold text-[var(--color-ink)]">
                  {brief.styleLikes.map((t) => STYLE_LABELS[t]).join(', ')}
                </strong>
                . That&rsquo;s the direction we&rsquo;ll match on.
              </p>
            ) : null}
          </div>
        ),
      };

    case 5:
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
            onChange={(styleDislikes) => update({ styleDislikes })}
          />
        ),
      };

    case 6:
      return householdStep(brief, update);

    case 7:
      return priorityStep(brief, update);

    case 8:
      return {
        ask: (
          <Ask
            title="How involved do you want to be?"
            hint="The most common reason a project goes wrong is a mismatch here — not a mismatch in taste."
          />
        ),
        options: (
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
        ),
      };

    case 9:
      return {
        ask: (
          <Ask
            title="Last one — when do you want to move in?"
            hint="An honest date helps far more than an optimistic one."
          />
        ),
        options: (
          <div>
            <input
              type="date"
              value={brief.moveInBy?.slice(0, 10) ?? ''}
              onChange={(e) => update({ moveInBy: e.target.value || null })}
              className="tabular rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3 text-[15px] text-[var(--color-ink)]"
            />
            <p className="mt-5 max-w-[48ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
              A full-home project in Pune usually runs 70 to 130 days from sign-off. If your date is
              tighter than that, we&rsquo;ll say so — rather than quietly match you to someone who
              will miss it.
            </p>
          </div>
        ),
      };

    default:
      return null;
  }
}

const DEFAULT_BUDGET_LAKHS = 8;
/** The lower bound is 80% of the slider value. Basis points, not a float rate. */
const BUDGET_FLOOR_BPS = 8000;

function budgetStep(brief: Brief, update: (p: Partial<Brief>) => void): StepParts {
  const committed = brief.budgetMaxPaise !== null;
  const lakhs = committed
    ? Math.round(brief.budgetMaxPaise! / 100 / 100_000)
    : DEFAULT_BUDGET_LAKHS;

  function setLakhs(v: number) {
    const max = lakhsToPaise(v);
    update({ budgetMaxPaise: max, budgetMinPaise: applyBps(max, BUDGET_FLOOR_BPS) });
  }

  // Commit the default the first time this step renders. Without this the
  // slider shows ₹8L, the user agrees with it, and Continue stays disabled
  // because budgetMaxPaise is still null — with no way to fire a change event
  // except moving the slider away and back. A blocked core flow.
  if (!committed) setLakhs(DEFAULT_BUDGET_LAKHS);

  const shownMin = brief.budgetMinPaise ?? applyBps(lakhsToPaise(lakhs), BUDGET_FLOOR_BPS);
  const shownMax = brief.budgetMaxPaise ?? lakhsToPaise(lakhs);

  return {
    ask: (
      <Ask
        title="What are you planning to spend?"
        hint="A range is fine, and it isn't a commitment. It just stops us showing you studios who don't work at your level."
      />
    ),
    options: (
      <div className="max-w-lg">
        <div className="tabular mb-4 font-[family-name:var(--font-display)] text-[clamp(34px,6vw,50px)] leading-none tracking-[-0.02em] text-[var(--color-ink)]">
          {formatINRCompact(shownMin)} – {formatINRCompact(shownMax)}
        </div>
        <input
          type="range"
          min={2}
          max={40}
          step={1}
          value={lakhs}
          onChange={(e) => setLakhs(Number(e.target.value))}
          className="w-full accent-[var(--color-petrol)]"
          aria-label="Budget in lakhs"
        />
        <div className="label mt-1 flex justify-between">
          <span>₹2 L</span>
          <span>₹40 L</span>
        </div>

        {/* Anchoring + expectation setting. Killing an unqualified lead here is
            far cheaper for everyone than killing it at the quotation. */}
        <p className="mt-6 rounded-[10px] bg-[var(--color-paper-2)] px-4 py-3.5 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          {budgetGuidance(lakhs)}
        </p>
      </div>
    ),
  };
}

function budgetGuidance(lakhs: number): string {
  if (lakhs < 5)
    return 'At this level you are looking at essentials — modular kitchen, wardrobes, painting, basic electrical. Full civil work and false ceilings will not fit.';
  if (lakhs < 10)
    return 'This covers a standard 2BHK end to end: kitchen, wardrobes, false ceiling in the living areas, painting, electrical and basic furnishing.';
  if (lakhs < 18)
    return 'A complete 3BHK with better material grades, more built-in storage and lighting design. This is the most common band in Pune.';
  if (lakhs < 28)
    return 'Premium finishes throughout — veneer and laminate upgrades, bespoke joinery, full lighting and furnishing.';
  return 'Bespoke territory. Custom furniture, imported hardware and a longer design phase. Expect five to six months.';
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
        hint="This drives the practical side of the match — storage, durability, how the space actually gets used."
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
      {/* The heading and the hint used to point in OPPOSITE directions.
          "If you had to give one of these up, which goes first?" asks for the
          LEAST important thing. "Tap them in order, most important first" asks
          for the most. A reader who trusted the heading ranked the list
          backwards — and `priorityRanking[0]` is treated everywhere as the
          thing that matters most, so that answer silently inverted the single
          largest input to the matching engine. Nobody would ever have seen it
          go wrong: the customer gets confidently ranked studios that suit the
          opposite of what they said.

          Both lines now ask the same question, in the same direction. */}
      <Ask
        title="What matters most to you here?"
        hint="Tap them in order, starting with the most important. This single answer does more matching work than any other."
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
              // Without this the accessibility tree shows four unlabelled
              // buttons: the visible text sits in nested spans alongside a
              // rank number and the word "Remove", which do not compose into a
              // usable name. A screen reader user was being asked to rank four
              // things called "button".
              aria-label={`${PRIORITY_LABELS[k]} — ranked ${i + 1}. Tap to remove from the ranking.`}
              className="flex items-center gap-3 rounded-full border-2 border-[var(--color-petrol)] bg-[var(--color-petrol-soft)] px-4 py-3 text-left text-[15px] text-[var(--color-ink)]"
            >
              <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-petrol)] font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-paper)]">
                {i + 1}
              </span>
              <Icon className="h-6 w-6 shrink-0 text-[var(--color-petrol)]" />
              <span className="flex-1">{PRIORITY_LABELS[k]}</span>
              <span className="label m-0">Remove</span>
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
              className="flex items-center gap-3 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-3 text-left text-[15px] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-petrol)]"
            >
              <span className="h-6 w-6 shrink-0" />
              <Icon className="h-6 w-6 shrink-0 text-[var(--color-ink-3)]" />
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
  matchCount,
  className = '',
}: {
  brief: Brief;
  matchCount: number;
  className?: string;
}) {
  const rows: Array<[string, string]> = [];

  if (brief.propertyType) {
    const loc = PUNE_LOCALITIES.find((l) => l.slug === brief.locality)?.label;
    rows.push(['Home', `${PROPERTY_LABELS[brief.propertyType]}${loc ? ` · ${loc}` : ''}`]);
  }
  if (brief.scope) rows.push(['Scope', SCOPE_LABELS[brief.scope]]);
  if (brief.budgetMinPaise && brief.budgetMaxPaise) {
    rows.push([
      'Budget',
      `${formatINRCompact(brief.budgetMinPaise)} – ${formatINRCompact(brief.budgetMaxPaise)}`,
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
  if (brief.involvement) rows.push(['Working style', INVOLVEMENT_LABELS[brief.involvement]]);

  return (
    <aside
      className={`rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-5 ${className}`}
    >
      <p className="label m-0 mb-4">Your brief so far</p>

      {rows.length === 0 ? (
        <p className="m-0 text-[14px] italic text-[var(--color-ink-3)]">
          This fills in as you answer.
        </p>
      ) : (
        <dl className="m-0 flex flex-col gap-3.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <dt className="label m-0">{k}</dt>
              <dd className="m-0 text-[14.5px] leading-snug text-[var(--color-ink)]">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-5 flex items-baseline gap-2 border-t border-[var(--color-rule)] pt-4">
        <span className="tabular font-[family-name:var(--font-display)] text-[30px] leading-none text-[var(--color-petrol)]">
          {matchCount}
        </span>
        <span className="text-[13.5px] text-[var(--color-ink-2)]">
          studio{matchCount === 1 ? '' : 's'} still match
        </span>
      </div>
    </aside>
  );
}

// ── Primitives ─────────────────────────────────────────────────

function Ask({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="lg:pt-4">
      <h1 className="h1 mb-4 max-w-[16ch]">{title}</h1>
      {hint ? <p className="m-0 max-w-[42ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">{hint}</p> : null}
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
         Twelve pixels of tile is not worth a hidden required field. */
      className={`relative flex h-[122px] w-[122px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-full px-3 text-center transition-all ${
        selected
          ? 'bg-[var(--color-petrol-soft)] ring-2 ring-[var(--color-petrol)]'
          : 'bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)]'
      }`}
    >
      <Icon
        className={`h-10 w-10 ${selected ? 'text-[var(--color-petrol)]' : 'text-[var(--color-ink-2)]'}`}
      />
      <span className="text-[12.5px] leading-tight text-[var(--color-ink-2)]">{label}</span>
      {selected ? (
        <span
          className="absolute right-3 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-petrol)] text-[11px] leading-none text-[var(--color-paper)]"
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
          ? 'border-[var(--color-petrol)] bg-[var(--color-petrol-soft)] text-[var(--color-ink)]'
          : 'border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-ink-2)] hover:border-[var(--color-ink-3)]'
      }`}
    >
      {Icon ? <Icon className="h-5 w-5" /> : null}
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.13em] text-[var(--color-ink-3)]">
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
    <div className="flex items-center justify-between gap-4 rounded-full bg-[var(--color-paper-2)] py-2.5 pl-5 pr-2.5">
      <span className="flex items-center gap-3 text-[15px] text-[var(--color-ink)]">
        <Icon className="h-6 w-6 text-[var(--color-ink-3)]" />
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Decrease ${label}`}
          className="h-9 w-9 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] text-[18px] leading-none text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-petrol)]"
        >
          −
        </button>
        <span className="tabular w-6 text-center text-[16px]">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
          className="h-9 w-9 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] text-[18px] leading-none text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-petrol)]"
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
}: {
  selected: StyleTag[];
  max: number;
  exclude: StyleTag[];
  onChange: (tags: StyleTag[]) => void;
  tone?: 'include' | 'exclude';
}) {
  function toggle(tag: StyleTag) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else if (selected.length < max) {
      onChange([...selected, tag]);
    }
  }

  const ring =
    tone === 'exclude' ? 'ring-2 ring-[var(--color-atrisk)]' : 'ring-2 ring-[var(--color-petrol)]';

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
              <StyleScene tag={tag} className="block aspect-[4/3] w-full" />
              <span
                className={`block bg-[var(--color-paper-2)] px-3 py-2 text-[12.5px] ${
                  isSelected ? 'font-bold text-[var(--color-ink)]' : 'text-[var(--color-ink-3)]'
                }`}
              >
                {isSelected ? STYLE_LABELS[tag] : isBlocked ? 'Already picked' : `Room ${i + 1}`}
              </span>
              {isSelected ? (
                <span
                  className={`absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] leading-none text-white ${
                    tone === 'exclude' ? 'bg-[var(--color-atrisk)]' : 'bg-[var(--color-petrol)]'
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
        <p className="m-0 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
          {selected.length} of {max} selected
        </p>
        {selected.length > 0 && tone === 'include' ? (
          <MaterialSwatches tag={selected[selected.length - 1]} />
        ) : null}
      </div>
    </>
  );
}

// ── Validation ─────────────────────────────────────────────────

function isStepAnswered(brief: Brief, step: number): boolean {
  switch (step) {
    case 1:
      return brief.propertyType !== null && brief.locality !== null;
    case 2:
      return brief.scope !== null;
    case 3:
      return brief.budgetMaxPaise !== null;
    case 4:
      // Two, not one. The question asks for three and the reveal on /match
      // reads "leaning X, with a bit of Y" — a single pick makes that sentence
      // impossible and gives the matcher nothing to weigh against.
      return brief.styleLikes.length >= 2;
    case 5:
      return true; // optional, but high-signal when given
    case 6:
      /**
       * Answered by default, because the screen already shows a real answer.
       *
       * The step renders two adults, no children, no elderly — the modal Pune
       * household — and used to leave Continue disabled behind "Pick an answer
       * to continue" until you nudged a stepper. So the product displayed an
       * answer and then denied it had one, and the only way forward was to
       * change something you agreed with and change it back.
       *
       * Nothing is hidden by accepting it: the defaults are on screen, they
       * are what we would have assumed anyway, and anyone whose household
       * differs can see at a glance that it needs changing.
       */
      return true;
    case 7:
      return brief.priorityRanking.length === 4;
    case 8:
      return brief.involvement !== null;
    case 9:
      return true;
    default:
      return false;
  }
}
