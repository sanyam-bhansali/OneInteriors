'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/modules/auth/session';
import { revalidateRoster } from '@/modules/studio/roster-cache';
import { readImageTags, withImageTag } from '@/modules/discover/tags';
import { PHOTO_ROOMS, type PhotoSuggestion } from '@/modules/discover/suggest';
import { suggestPhotoTags } from '@/modules/discover/suggest-read';
import { STYLE_TAGS } from '@/modules/brief/types';

/**
 * Ops photo tagging for Discover (owner, 7 Nov 2026). Every action checks the
 * role itself: the /ops layout guards pages, not actions.
 */

export async function savePhotoAction(
  projectId: string,
  index: number,
  patch: { room?: string; materials?: string[]; checked?: boolean },
): Promise<{ ok: boolean }> {
  const user = await requireRole('OPS');
  const project = await prisma.portfolioProject.findUnique({ where: { id: projectId } });
  if (!project || !Number.isInteger(index) || index < 0 || index >= project.images.length) return { ok: false };
  // A render or a photo without the studio's consent can never be checked in.
  if (patch.checked && (project.isRender || !project.pickerConsent)) return { ok: false };

  const rooms = project.images.map((_, i) => project.imageRooms[i] ?? '');
  if (patch.room !== undefined) rooms[index] = (PHOTO_ROOMS as readonly string[]).includes(patch.room) ? patch.room : '';

  const tags = withImageTag(
    readImageTags(project.imageTags, project.images.length),
    index,
    { materials: patch.materials, checked: patch.checked },
    user.email ?? user.id,
    new Date(),
  );
  await prisma.portfolioProject.update({
    where: { id: projectId },
    data: { imageRooms: rooms, imageTags: JSON.parse(JSON.stringify(tags)) },
  });
  await revalidateRoster();
  revalidatePath('/ops/discover-photos');
  return { ok: true };
}

/** The project's styles, for every photo in it at once. */
export async function saveProjectStylesAction(projectId: string, styles: string[]): Promise<{ ok: boolean }> {
  await requireRole('OPS');
  const clean = [...new Set(styles.filter((s) => (STYLE_TAGS as readonly string[]).includes(s)))].slice(0, 3);
  if (clean.length === 0) return { ok: false };
  await prisma.portfolioProject.update({ where: { id: projectId }, data: { styleTags: clean } });
  await revalidateRoster();
  revalidatePath('/ops/discover-photos');
  return { ok: true };
}

export async function suggestPhotoAction(projectId: string, index: number): Promise<PhotoSuggestion | null> {
  await requireRole('OPS');
  const project = await prisma.portfolioProject.findUnique({ where: { id: projectId }, select: { images: true } });
  const url = project?.images[index];
  return url ? suggestPhotoTags(url) : null;
}
