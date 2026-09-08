import 'server-only';

/**
 * Storing, reading and approving a drafted profile.
 *
 * The whole point of the separation between `ProfileDraft` and `Studio` is that
 * **a draft can never be mistaken for published copy.** Generating writes only
 * to the draft table. Publishing is a separate, explicit act performed by a
 * person at the studio, and it is the only thing in this file that touches the
 * Studio row.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { anthropicModel } from '@/lib/env';
import { requireRole } from '@/modules/auth/session';
import { currentStudio } from './onboarding';
import { draftPortfolio } from './portfolio-agent';
import type { PortfolioDraft, VerificationIssue } from './portfolio-draft';

export interface StoredDraft {
  headline: string;
  introduction: string;
  notFor: string;
  stories: { title: string; story: string }[];
  model: string;
  issues: VerificationIssue[];
  generatedAt: Date;
  approvedAt: Date | null;
}

export type GenerateResult = { ok: true; issues: VerificationIssue[] } | { ok: false; error: string };

/**
 * Draft the signed-in studio's profile.
 *
 * Replaces any previous unapproved draft — a studio regenerating wants the new
 * one, and keeping a pile of rejected drafts around invites publishing the
 * wrong one. An *approved* draft is overwritten too, but the published copy on
 * the Studio row is untouched until they approve again.
 */
export async function generateDraft(): Promise<GenerateResult> {
  const context = await currentStudio();
  if (!context) return { ok: false, error: 'No studio is linked to this account.' };

  const result = await draftPortfolio(context.studio.id);
  if (!result.ok) return { ok: false, error: result.error };

  await prisma.profileDraft.upsert({
    where: { studioId: context.studio.id },
    create: {
      studioId: context.studio.id,
      headline: result.draft.headline,
      introduction: result.draft.introduction,
      notFor: result.draft.notFor,
      stories: result.draft.projectStories as unknown as Prisma.InputJsonValue,
      model: anthropicModel(),
      issues: result.issues as unknown as Prisma.InputJsonValue,
    },
    update: {
      headline: result.draft.headline,
      introduction: result.draft.introduction,
      notFor: result.draft.notFor,
      stories: result.draft.projectStories as unknown as Prisma.InputJsonValue,
      model: anthropicModel(),
      issues: result.issues as unknown as Prisma.InputJsonValue,
      generatedAt: new Date(),
      // A new draft is unapproved, always. Regenerating must never inherit the
      // approval of the text it replaced.
      approvedAt: null,
      approvedById: null,
    },
  });

  return { ok: true, issues: result.issues };
}

export async function readDraft(): Promise<StoredDraft | null> {
  const context = await currentStudio();
  if (!context) return null;

  const row = await prisma.profileDraft.findUnique({
    where: { studioId: context.studio.id },
  });
  if (!row) return null;

  return {
    headline: row.headline,
    introduction: row.introduction,
    notFor: row.notFor,
    stories: (row.stories as unknown as { title: string; story: string }[]) ?? [],
    model: row.model,
    issues: (row.issues as unknown as VerificationIssue[]) ?? [],
    generatedAt: row.generatedAt,
    approvedAt: row.approvedAt,
  };
}

export type ApproveResult = { ok: true } | { ok: false; error: string };

/**
 * Publish the draft as the studio's own words.
 *
 * Takes the *edited* text, not the stored draft — the studio almost always
 * changes something, and publishing what the model wrote rather than what the
 * person approved would make the approval meaningless. Once this runs, the copy
 * is theirs: no part of the profile is attributed to a model, because they
 * signed off on every word.
 */
export async function approveDraft(edited: PortfolioDraft): Promise<ApproveResult> {
  const user = await requireRole('STUDIO');
  const context = await currentStudio();
  if (!context) return { ok: false, error: 'No studio is linked to this account.' };

  const headline = edited.headline?.trim() ?? '';
  const introduction = edited.introduction?.trim() ?? '';
  const notFor = edited.notFor?.trim() ?? '';

  if (headline.length < 10) return { ok: false, error: 'The headline is too short.' };
  if (introduction.length < 80) return { ok: false, error: 'The introduction is too short.' };
  if (notFor.length < 20) {
    return { ok: false, error: 'Say who this studio is not for. It is the part readers trust.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.studio.update({
      where: { id: context.studio.id },
      data: { headline, notFor, about: introduction },
    });

    await tx.profileDraft.update({
      where: { studioId: context.studio.id },
      data: {
        headline,
        introduction,
        notFor,
        approvedAt: new Date(),
        approvedById: user.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'profile.approve',
        entityType: 'Studio',
        entityId: context.studio.id,
        after: { headline, approvedBy: user.email } as Prisma.InputJsonValue,
      },
    });
  });

  return { ok: true };
}
