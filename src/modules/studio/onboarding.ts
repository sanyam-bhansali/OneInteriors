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
import { Prisma } from '@prisma/client';
import { requireRole, type AuthUser } from '@/modules/auth/session';
import { validateGstin } from '@/modules/verification/gstin';
import { missingCoreRates } from '@/modules/quotation/categories';
import { lakhsToPaise } from '@/lib/money';
import { onboardingProgress, MIN_ABOUT_LENGTH } from './onboarding-steps';
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
  assessSteps,
  onboardingProgress,
  readyForReview,
  type OnboardingStep,
  type StepStatus,
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
  };
}

/**
 * The signed-in user's studio. Ops and admins are deliberately *not* given a
 * studio here — an ops account editing a studio's own words through the studio
 * UI would leave an audit trail saying the studio wrote it.
 */
export async function currentStudio(): Promise<StudioContext | null> {
  const user = await requireRole('STUDIO');

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

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  await prisma.studio.update({
    where: { id: context.studio.id },
    data: {
      about,
      localities,
      website: input.website?.trim() || null,
      instagram: input.instagram?.trim() || null,
      yearsActive: input.yearsActive ?? null,
      teamSize: input.teamSize ?? null,
      minProjectPaise: input.minLakhs ? BigInt(lakhsToPaise(input.minLakhs)) : null,
      maxProjectPaise: input.maxLakhs ? BigInt(lakhsToPaise(input.maxLakhs)) : null,
    },
  });

  return { ok: true };
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
    data: { gstin: result.gstin },
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
    },
  });

  return { ok: true };
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
