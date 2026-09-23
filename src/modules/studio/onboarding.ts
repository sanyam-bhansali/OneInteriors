import 'server-only';

/**
 * Studio onboarding — the studio fills in its own detail.
 *
 * Approval creates the Studio in ONBOARDING and emails the owner a sign-in
 * link. From there they do the typing, for two reasons: it is better data than
 * us transcribing a phone call, and it is far less of our time per studio,
 * which is what makes a curated roster possible at all.
 *
 * Three rules hold across this file:
 *
 *  1. **Nothing here can make a studio visible.** Completing every step moves
 *     the studio to "ready for review", never to ACTIVE. Only ops flips that,
 *     and only after the checks in `verification/` have been recorded. A studio
 *     cannot promote itself by filling in a form.
 *  2. **Nothing here touches `tier`.** The tier is computed from checks we
 *     performed. Self-declared fields are shown and never scored.
 *  3. **A GSTIN entered here is a claim, not a verification.** It is checksum-
 *     validated offline so we catch typos immediately, then still has to be
 *     confirmed against the portal by ops before it earns anything.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { Prisma } from '@prisma/client';
import { getCurrentUser, hasRole, type AuthUser } from '@/modules/auth/session';
import { validateGstin } from '@/modules/verification/gstin';
import { missingCoreRates } from '@/modules/quotation/categories';
import { lakhsToPaise } from '@/lib/money';
import {
  isOurImageUrl,
  MAX_IMAGES_PER_PROJECT,
  storePortfolioImage,
} from '@/modules/storage/portfolio-images';
import { isOffering, isPriceLevel } from './positioning';
import {
  onboardingProgress,
  MIN_ABOUT_LENGTH,
  MAX_ABOUT_LENGTH,
  MIN_SHORTFALL_NOTE,
} from './onboarding-steps';
import {
  STYLE_TAGS,
  PUNE_LOCALITIES,
  PROPERTY_LABELS,
  SCOPE_LABELS,
} from '@/modules/brief/types';

export {
  ONBOARDING_STEPS,
  STEP_LABELS,
  STEP_BLURBS,
  MIN_PORTFOLIO_PROJECTS,
  MIN_SHORTFALL_NOTE,
  assessSteps,
  onboardingProgress,
  readyForReview,
  gateFor,
  firstIncomplete,
  percentComplete,
  type OnboardingStep,
  type StepStatus,
  type StepGate,
} from './onboarding-steps';

export interface StudioContext {
  user: AuthUser;
  studio: {
    id: string;
    slug: string;
    tradeName: string;
    legalName: string;
    about: string | null;
    localities: string[];
    website: string | null;
    instagram: string | null;
    gstin: string | null;
    yearsActive: number | null;
    teamSize: number | null;
    minProjectPaise: bigint | null;
    maxProjectPaise: bigint | null;
    status: string;
    portfolioCount: number;
    missingRates: string[];
    submittedForReview: boolean;
    gstinNotApplicable: boolean;
    gstinNote: string | null;
    addressLine: string | null;
    pincode: string | null;
    /** Positioning. Self-declared, shown, never scored. */
    offering: string | null;
    priceLevel: string | null;
    portfolioShortfallNote: string | null;
  };
}

/**
 * The signed-in user's studio. Ops and admins are deliberately *not* given a
 * studio here — an ops account editing a studio's own words through the studio
 * UI would leave an audit trail saying the studio wrote it.
 *
 * ## Why this reads the session rather than requiring a role
 *
 * `requireRole` throws, and every caller of this is a page render. Next renders
 * a layout and its page in parallel, so a throw here beats the layout's
 * redirect and a signed-out visitor gets a 500 instead of the sign-in screen.
 * That is not hypothetical — it is the bug that took /ops down, and the fix
 * there was to strip the throwing guard out of every render-path read.
 *
 * Returning null is the correct behaviour anyway: the callers already handle
 * "no studio on this account", and a non-studio user has no studio by
 * definition.
 *
 * Note that this is still the authorisation check for every write in this file,
 * not just a convenience for rendering — each of them begins with
 * `const context = await currentStudio()` and refuses on null. The role test
 * above is what makes that safe, so it must not be weakened to a bare
 * membership lookup.
 */
export async function currentStudio(): Promise<StudioContext | null> {
  const user = await getCurrentUser();
  // `hasRole` is not a type predicate, so the null check has to stand on its
  // own or `user.id` below is an error.
  if (!user || !hasRole(user, 'STUDIO')) return null;

  /**
   * Guarded, and the guard matters more here than almost anywhere else.
   *
   * This is the first `await` on all six studio routes, and it was the only
   * read on the surface with neither a `hasDatabase()` check nor a try/catch —
   * so an unset `DATABASE_URL` or an unreachable database took the entire
   * studio side down with an unhandled throw, while the layout wrapped around
   * it degraded politely. Every caller already handles null, which is the
   * honest answer to "which studio is this" when we cannot ask.
   */
  if (!hasDatabase()) return null;

  try {
    return await loadStudio(user);
  } catch (error) {
    console.error('[studio] currentStudio failed', error);
    return null;
  }
}

async function loadStudio(user: AuthUser): Promise<StudioContext | null> {
  const member = await prisma.studioMember.findUnique({
    where: { userId: user.id },
    include: { studio: { include: { _count: { select: { portfolio: true } } } } },
  });
  if (!member) return null;

  const s = member.studio;
  const steps = readSteps(s.onboardingSteps);

  const rateItems = await prisma.rateCardItem.findMany({
    where: { studioId: s.id },
    select: { category: true, ratePaise: true },
  });
  const rates: Partial<Record<string, number>> = {};
  for (const item of rateItems) rates[item.category] = Number(item.ratePaise);

  return {
    user,
    studio: {
      id: s.id,
      slug: s.slug,
      tradeName: s.tradeName,
      legalName: s.legalName,
      about: s.about,
      localities: s.localities,
      website: s.website,
      instagram: s.instagram,
      gstin: s.gstin,
      yearsActive: s.yearsActive,
      teamSize: s.teamSize,
      minProjectPaise: s.minProjectPaise,
      maxProjectPaise: s.maxProjectPaise,
      status: s.status,
      portfolioCount: s._count.portfolio,
      missingRates: missingCoreRates(rates as never),
      submittedForReview: steps.submittedForReview === true,
      gstinNotApplicable: s.gstinNotApplicable,
      gstinNote: s.gstinNote,
      addressLine: s.addressLine,
      pincode: s.pincode,
      offering: s.offering,
      priceLevel: s.priceLevel,
      portfolioShortfallNote: s.portfolioShortfallNote,
    },
  };
}

interface StepState {
  submittedForReview?: boolean;
  submittedAt?: string;
}

function readSteps(value: Prisma.JsonValue | null): StepState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as StepState;
}

// ── Writes ─────────────────────────────────────────────────────

export type SaveResult = { ok: true } | { ok: false; errors: Record<string, string> };

export interface ProfileInput {
  about: string;
  localities: string[];
  website: string;
  instagram: string;
  yearsActive?: number;
  teamSize?: number;
  minLakhs?: number;
  maxLakhs?: number;
}

/**
 * Keep what has been typed so far, without judging it.
 *
 * ## Why this exists alongside `saveProfile`
 *
 * `saveProfile` is deliberately all-or-nothing: it refuses to write anything
 * unless every field `assessSteps` needs is present and valid, because a form
 * that accepts blanks and answers "Saved." is how a studio ends up told that
 * nothing is wrong and that something is missing, in that order. The comment
 * on that function is the record of it happening.
 *
 * That makes it exactly the wrong function to autosave with. Called every few
 * seconds while somebody is halfway through, it would store nothing at all —
 * so the one thing autosave is for, not losing work to a closed tab, would
 * not happen — and it would paint the form red for fields they have not
 * reached yet.
 *
 * So the two paths are split by what they are for. This one **writes and
 * never validates**; the Save button **validates and never partially
 * writes**. Neither claims anything about the other.
 *
 * ## Why a partial write is safe here
 *
 * Because completeness in this model is derived, never stored. Every one of
 * these columns is nullable and `assessSteps` recomputes the step from
 * whatever is in them on every render, so a half-filled profile is an
 * ordinary state the model already knows how to describe — it comes back as
 * an unticked step with a list of what is short, which is true. There is no
 * flag here that a partial write could desynchronise, which is the whole
 * reason the derived design was chosen.
 *
 * ## An empty field means empty
 *
 * A blank arrives as `null` rather than being skipped. Treating blank as "no
 * change" would make a cleared field impossible to clear: the studio deletes
 * their team size, the autosave ignores it, and the old number reappears when
 * they reload. Re-locking whatever depended on that field is correct and is
 * handled by `gateFor` without any bookkeeping.
 *
 * Returns nothing a caller should show. Autosave is background work, and a
 * background failure is not the studio's problem to read about mid-sentence —
 * the Save button is still there and still says what is wrong.
 */
export async function saveProfileDraft(input: ProfileInput): Promise<{ ok: boolean }> {
  const context = await currentStudio();
  if (!context) return { ok: false };

  const localities = input.localities.filter((l) =>
    PUNE_LOCALITIES.some((p) => p.slug === l),
  );

  await prisma.studio.update({
    where: { id: context.studio.id },
    data: {
      /* Truncated rather than refused. The column has a limit and the draft
         has no right to reject anything, so the one lossy case is capped at
         the same length the validator would demand, where the Save button
         will explain it properly. */
      about: input.about?.trim().slice(0, MAX_ABOUT_LENGTH) || null,
      localities,
      website: input.website?.trim() || null,
      instagram: input.instagram?.trim() || null,
      // `?? null` throughout, not `|| null` — 0 is a real answer for years
      // active, and for a studio in its first year `||` would store it as
      // unanswered every time the autosave ran.
      yearsActive: input.yearsActive ?? null,
      teamSize: input.teamSize ?? null,
      minProjectPaise: input.minLakhs ? BigInt(lakhsToPaise(input.minLakhs)) : null,
      maxProjectPaise: input.maxLakhs ? BigInt(lakhsToPaise(input.maxLakhs)) : null,
    },
  });

  return { ok: true };
}

export async function saveProfile(input: ProfileInput): Promise<SaveResult> {
  const context = await currentStudio();
  if (!context) return { ok: false, errors: { form: 'No studio is linked to this account.' } };

  const errors: Record<string, string> = {};
  const about = input.about?.trim() ?? '';

  if (about.length < MIN_ABOUT_LENGTH) {
    errors.about = 'Eighty characters or more — a customer decides from this.';
  }
  if (about.length > 1200) errors.about = 'Keep it under 1,200 characters.';

  const localities = input.localities.filter((l) =>
    PUNE_LOCALITIES.some((p) => p.slug === l),
  );
  if (localities.length === 0) errors.localities = 'Pick at least one area.';

  if (input.minLakhs && input.maxLakhs && input.minLakhs > input.maxLakhs) {
    errors.minLakhs = 'The smallest project cannot be larger than the largest.';
  }

  /**
   * These four are required by `assessSteps`, and were not validated here.
   *
   * The effect was a form that accepted blanks, returned a green "Saved.", and
   * left the step unticked with "Still needed: years active, team size" back on
   * the checklist. The studio had done exactly what the page asked and was told
   * nothing was wrong and that something was missing, in that order. Validating
   * at the point of saving is the only place that reads as an answer rather
   * than a contradiction.
   */
  if (input.yearsActive === undefined) {
    errors.yearsActive = 'How long have you been going? Put 0 if this is your first year.';
  }
  if (input.teamSize === undefined) {
    errors.teamSize = 'How many of you are there? Including yourself.';
  }
  if (input.minLakhs === undefined) {
    errors.minLakhs = 'The smallest project you will take. This is the filter that protects your time.';
  }
  if (input.maxLakhs === undefined) {
    errors.maxLakhs = 'And the largest you are set up to deliver.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  await prisma.studio.update({
    where: { id: context.studio.id },
    data: {
      about,
      localities,
      website: input.website?.trim() || null,
      instagram: input.instagram?.trim() || null,
      // `?? null` and not `|| null` — a first-year studio answers 0, and `||`
      // would store that as "not answered".
      yearsActive: input.yearsActive ?? null,
      teamSize: input.teamSize ?? null,
      minProjectPaise: input.minLakhs ? BigInt(lakhsToPaise(input.minLakhs)) : null,
      maxProjectPaise: input.maxLakhs ? BigInt(lakhsToPaise(input.maxLakhs)) : null,
    },
  });

  return { ok: true };
}

/**
 * The whole registration step, in one write.
 *
 * ## Why this exists next to `saveGstin` and `declareNoGstin` rather than
 * replacing them
 *
 * Those two are still the ops-side path and still the smallest correct unit:
 * ops records a number for a studio without touching their address. This is
 * the studio-facing path, where the screen has one button and therefore has
 * to be one transaction.
 *
 * ## Everything is validated before anything is written
 *
 * The obvious build is to call the three existing functions in a row. It is
 * also wrong: a good address followed by a rejected GSTIN leaves the address
 * saved and the form showing an error, so pressing the button again re-saves
 * a field that was already fine — and if the studio then walks away, half the
 * step is recorded and the page never said so. Collecting the errors first
 * means the step either moves or does not.
 *
 * ## The two GST answers stay mutually exclusive
 *
 * Recording a number clears the note and vice versa, the same rule the
 * separate functions enforce. Leaving both set shows whoever verifies them a
 * contradiction, and a person resolving that by guessing is the failure the
 * field was added to prevent.
 */
export async function saveRegistration(input: {
  addressLine: string;
  pincode: string;
  /** Which answer the studio is giving to the GST question. */
  answer: 'has' | 'none';
  gstin: string;
  gstinNote: string;
}): Promise<SaveResult> {
  const context = await currentStudio();
  if (!context) return { ok: false, errors: { form: 'No studio is linked to this account.' } };

  const errors: Record<string, string> = {};

  const addressLine = input.addressLine?.trim() ?? '';
  const pincode = input.pincode?.trim() ?? '';

  if (addressLine.length < 8) {
    errors.addressLine = 'Enough that somebody could find you — building, street, area.';
  }
  /* First digit non-zero: no Indian pincode starts with one, so this is a
     free catch for a transposed digit or a phone number pasted by mistake. */
  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    errors.pincode = 'Six digits. Pune pincodes start 41.';
  }

  let gstin: string | null = null;
  let gstinNote: string | null = null;

  if (input.answer === 'has') {
    const result = validateGstin(input.gstin ?? '');
    if (!result.valid) {
      errors.gstin = result.reason;
    } else {
      const clash = await prisma.studio.findFirst({
        where: { gstin: result.gstin, id: { not: context.studio.id } },
        select: { id: true },
      });
      if (clash) {
        errors.gstin = 'Another studio is already registered with this GSTIN. Talk to us.';
      } else {
        gstin = result.gstin;
      }
    }
  } else {
    const note = input.gstinNote?.trim() ?? '';
    if (note.length < 10) {
      errors.gstinNote =
        'A sentence is enough — proprietorship below the threshold, registration in progress, whatever it is. It tells us how to verify you instead.';
    } else {
      gstinNote = note.slice(0, 500);
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  await prisma.studio.update({
    where: { id: context.studio.id },
    data: {
      addressLine,
      pincode,
      gstin,
      gstinNotApplicable: input.answer === 'none',
      gstinNote,
    },
  });

  /**
   * And through to the letterhead.
   *
   * `StudioBranding` snapshots these facts the first time a quotation needs
   * them, which is right — the name and address on a document are facts about
   * the day it was sent, and a live join would let a correction in 2027
   * silently rewrite what a client received in 2026.
   *
   * But a snapshot taken once and never refreshed means a GSTIN corrected
   * here keeps printing the old one for ever. So a correction on the
   * registration step pushes through to the branding row, and only from here:
   * this is the screen whose values ops verifies against the public
   * registries, so it is the only place the identity may change. Quotations
   * already issued are untouched — they carry their own snapshot.
   */
  await syncBrandingIdentity(context.studio.id).catch((error) => {
    /* A letterhead that is one edit behind is a smaller problem than a
       registration that would not save. */
    console.error('[onboarding] branding sync failed', error);
  });

  return { ok: true };
}

/**
 * Push the registration's identity into the branding row, if there is one.
 *
 * Deliberately does not CREATE the row — `myBranding()` owns that, and
 * creating one here would mean a studio who has never raised a quotation
 * carries a letterhead nothing has looked at.
 */
async function syncBrandingIdentity(studioId: string): Promise<void> {
  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { legalName: true, tradeName: true, addressLine: true, city: true, pincode: true, gstin: true },
  });
  if (!studio) return;

  const legalName = studio.legalName?.trim() || studio.tradeName?.trim();
  if (!legalName) return;

  await prisma.studioBranding.updateMany({
    where: { studioId },
    data: {
      legalName,
      addressLine: studio.addressLine,
      city: studio.city ? studio.city.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Pune',
      pincode: studio.pincode,
      gstin: studio.gstin,
    },
  });
}

/**
 * Record the studio's GSTIN.
 *
 * Validated offline so a typo is caught while they are still looking at the
 * certificate. It is stored as a **claim** — `VerificationCheck` is what turns
 * it into anything, and that only happens when ops confirms it against the
 * portal.
 */
export async function saveGstin(raw: string): Promise<SaveResult> {
  const context = await currentStudio();
  if (!context) return { ok: false, errors: { form: 'No studio is linked to this account.' } };

  const result = validateGstin(raw);
  if (!result.valid) return { ok: false, errors: { gstin: result.reason } };

  const clash = await prisma.studio.findFirst({
    where: { gstin: result.gstin, id: { not: context.studio.id } },
    select: { id: true },
  });
  if (clash) {
    return {
      ok: false,
      errors: { gstin: 'Another studio is already registered with this GSTIN. Talk to us.' },
    };
  }

  await prisma.studio.update({
    where: { id: context.studio.id },
    // Recording a number withdraws any earlier "we do not have one" — they are
    // mutually exclusive answers to the same question, and leaving both set
    // would show a verifier a contradiction to resolve by guessing.
    data: { gstin: result.gstin, gstinNotApplicable: false, gstinNote: null },
  });

  return { ok: true };
}

/**
 * The other answer: this studio has no GST registration.
 *
 * A declared absence, not a blank. The note is required because "no GSTIN" on
 * its own tells a verifier nothing about what to check instead, and the whole
 * point of accepting this answer is that it routes them to a different
 * verification path rather than out of the roster.
 */
export async function declareNoGstin(note: string): Promise<SaveResult> {
  const context = await currentStudio();
  if (!context) return { ok: false, errors: { form: 'No studio is linked to this account.' } };

  const trimmed = note.trim();
  if (trimmed.length < 10) {
    return {
      ok: false,
      errors: {
        gstinNote:
          'A sentence is enough — proprietorship below the threshold, registration in progress, whatever it is. It tells us how to verify you instead.',
      },
    };
  }

  await prisma.studio.update({
    where: { id: context.studio.id },
    data: { gstinNotApplicable: true, gstinNote: trimmed.slice(0, 500), gstin: null },
  });

  return { ok: true };
}

/**
 * A studio with fewer than three finished projects, telling us what it has
 * instead.
 *
 * ## Why this is a write and not a checkbox
 *
 * The parallel is `declareNoGstin`, and the reasoning is the same: we are not
 * waiving the requirement, we are routing the studio to a person. "Two
 * finished, one handing over in November, and you are welcome to come and see
 * the Wakad site" is something ops can act on. A ticked box is not.
 *
 * So there is no boolean here. The note IS the declaration, which means the
 * flag and its explanation cannot drift apart — a failure the GSTIN pair can
 * still have in principle and this one cannot.
 *
 * ## What it does not do
 *
 * It does not mark anything verified and it does not touch the tier. It
 * unblocks the submit button, and everything after that is a judgement a
 * person makes with this text in front of them.
 */
export async function declarePortfolioShortfall(note: string): Promise<SaveResult> {
  const context = await currentStudio();
  if (!context) return { ok: false, errors: { form: 'No studio is linked to this account.' } };

  const trimmed = note.trim();
  if (trimmed.length < MIN_SHORTFALL_NOTE) {
    return {
      ok: false,
      errors: {
        portfolioShortfallNote:
          'A couple of sentences. What is finished, what is running, and anywhere we could go and look — that is what we read.',
      },
    };
  }

  await prisma.studio.update({
    where: { id: context.studio.id },
    data: { portfolioShortfallNote: trimmed.slice(0, 1500) },
  });

  return { ok: true };
}

export interface ProjectInput {
  title: string;
  locality?: string;
  propertyType?: string;
  scope?: string;
  styleTags: string[];
  valueLakhs?: number;
  durationDays?: number;
  completedOn?: string;
  clientConsented: boolean;
  isRender: boolean;
  /**
   * Public URLs from `storePortfolioImage`, in display order.
   *
   * The first is the cover. Order is the whole meaning of this array, which
   * is why reordering is a rewrite of it rather than a column on a row.
   */
  images?: string[];
}

// Derived from the label maps rather than retyped, so these can never drift
// out of step with the enums the customer quiz writes.
const PROPERTY_TYPES = Object.keys(PROPERTY_LABELS);
const SCOPE_TYPES = Object.keys(SCOPE_LABELS);

export async function addProject(input: ProjectInput): Promise<SaveResult> {
  const context = await currentStudio();
  if (!context) return { ok: false, errors: { form: 'No studio is linked to this account.' } };

  const errors: Record<string, string> = {};
  const title = input.title?.trim() ?? '';
  if (title.length < 3) errors.title = 'Give the project a name.';

  // Style tags have to come from the same vocabulary the customer quiz uses,
  // or matching silently stops working — a studio tagged "modern" would never
  // meet a customer who asked for "warm-modern".
  const styleTags = input.styleTags.filter((t) => (STYLE_TAGS as readonly string[]).includes(t));
  if (styleTags.length === 0) errors.styleTags = 'Pick at least one style.';

  let completedOn: Date | null = null;
  if (input.completedOn) {
    const parsed = new Date(input.completedOn);
    if (Number.isNaN(parsed.getTime())) errors.completedOn = 'That date does not look right.';
    else if (parsed > new Date()) errors.completedOn = 'This list is for finished work.';
    else completedOn = parsed;
  }

  // The honesty rule, enforced rather than requested. A render presented as a
  // photograph is the single most common lie in this industry, and the whole
  // product is an argument that we do not do that.
  if (!input.clientConsented && !input.isRender) {
    errors.clientConsented =
      'Confirm the client is happy for this to be shown, or mark it as a render.';
  }

  /**
   * Only URLs we issued.
   *
   * This array is rendered straight into `<img src>` on a public profile, so
   * an arbitrary string arriving from a form would be a way to have our own
   * pages load somebody else's tracker — and to let a studio point at an
   * image they do not control which later becomes something else. Filtered
   * rather than rejected: a URL that fails this test is one we did not write,
   * so dropping it loses nothing the studio put there.
   */
  const images = (input.images ?? []).filter(isOurImageUrl).slice(0, MAX_IMAGES_PER_PROJECT);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  await prisma.portfolioProject.create({
    data: {
      studioId: context.studio.id,
      title,
      locality: input.locality || null,
      propertyType: PROPERTY_TYPES.includes(input.propertyType ?? '')
        ? (input.propertyType as never)
        : null,
      scope: SCOPE_TYPES.includes(input.scope ?? '') ? (input.scope as never) : null,
      styleTags,
      valuePaise: input.valueLakhs ? BigInt(lakhsToPaise(input.valueLakhs)) : null,
      durationDays: input.durationDays ?? null,
      completedOn,
      isRender: input.isRender,
      clientConsented: input.clientConsented,
      images,
    },
  });

  return { ok: true };
}

/**
 * Take photographs for a project that does not exist yet.
 *
 * ## Why they are uploaded before the project is created
 *
 * The modal collects a project over four stages and writes the row once, at
 * the end. Pictures cannot wait for that: a studio drags in eight files and
 * has to see them appear, reorder them and pick a cover before they will
 * press anything. So the bytes go up first and the URLs are held in the
 * modal until the row is written.
 *
 * The cost is an orphan. Cancel the modal after uploading and the objects
 * stay in the bucket with nothing referencing them. That is deliberate and it
 * is the right way round: the alternative — creating a draft row so the
 * pictures have somewhere to hang — puts half-finished projects in the table
 * that `assessSteps` counts, and a studio would see "1 of 3 added" for a
 * project they abandoned. A few stranded kilobytes are cheaper than a
 * portfolio count that lies.
 *
 * Returns what stored and what did not, per file, so eight pictures with one
 * HEIC among them lose the HEIC and nothing else.
 */
export async function uploadProjectImages(
  files: File[],
): Promise<{ urls: string[]; skipped: string[] }> {
  const context = await currentStudio();
  if (!context) return { urls: [], skipped: [] };

  const urls: string[] = [];
  const skipped: string[] = [];

  for (const file of files.slice(0, MAX_IMAGES_PER_PROJECT)) {
    const result = await storePortfolioImage(context.studio.id, file);
    if (result.ok) urls.push(result.url);
    else skipped.push(result.error);
  }

  return { urls, skipped };
}

export async function removeProject(id: string): Promise<SaveResult> {
  const context = await currentStudio();
  if (!context) return { ok: false, errors: { form: 'No studio is linked to this account.' } };

  // Scoped to their own studio — an id from the URL is not proof of ownership.
  const project = await prisma.portfolioProject.findFirst({
    where: { id, studioId: context.studio.id },
    select: { id: true },
  });
  if (!project) return { ok: false, errors: { form: 'That project is not yours.' } };

  await prisma.portfolioProject.delete({ where: { id } });
  return { ok: true };
}

/**
 * How the studio positions itself.
 *
 * ## Why this is a separate write from the rate card
 *
 * They are on the same step and they are different kinds of fact. The rate
 * card is arithmetic the quoting engine runs; this is a claim shown to a
 * customer. Saving them together would mean a studio who picks "turnkey" and
 * has not filled in a wardrobe rate gets neither stored, and would tie a
 * positioning choice to the completeness of a price list.
 *
 * Neither field is required by `assessSteps`. The step completes on the rate
 * card, because that is the thing without which nothing works — a studio with
 * no offering set is merely undescribed, while a studio with no rates cannot
 * be quoted at all.
 */
export async function savePositioning(input: {
  offering: string;
  priceLevel: string;
}): Promise<SaveResult> {
  const context = await currentStudio();
  if (!context) return { ok: false, errors: { form: 'No studio is linked to this account.' } };

  /* Unrecognised becomes null rather than an error. These arrive from cards
     that can only emit the known values, so anything else is a hand-made POST
     — and the useful response to that is to store nothing, not to explain our
     vocabulary to it. */
  await prisma.studio.update({
    where: { id: context.studio.id },
    data: {
      offering: isOffering(input.offering) ? input.offering : null,
      priceLevel: isPriceLevel(input.priceLevel) ? input.priceLevel : null,
    },
  });

  return { ok: true };
}

export async function listProjects() {
  const context = await currentStudio();
  if (!context) return [];
  return prisma.portfolioProject.findMany({
    where: { studioId: context.studio.id },
    orderBy: [{ completedOn: 'desc' }, { createdAt: 'desc' }],
  });
}

/**
 * Hand the studio back to us.
 *
 * This does **not** publish them. It records that they consider themselves
 * finished, writes an audit entry, and puts them in front of ops. Visibility
 * still costs a site visit and a reference call.
 */
export async function submitForReview(): Promise<SaveResult> {
  const context = await currentStudio();
  if (!context) return { ok: false, errors: { form: 'No studio is linked to this account.' } };

  const { complete } = onboardingProgress({ ...context.studio, submittedForReview: true });
  if (!complete) {
    return { ok: false, errors: { form: 'Some steps are still incomplete.' } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.studio.update({
      where: { id: context.studio.id },
      data: {
        onboardingSteps: {
          submittedForReview: true,
          submittedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.user.id,
        action: 'onboarding.submit',
        entityType: 'Studio',
        entityId: context.studio.id,
        after: { submittedForReview: true } as Prisma.InputJsonValue,
      },
    });
  });

  return { ok: true };
}
