'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/modules/auth/session';
import { readAnonKey } from '@/modules/brief/repository';
import { savePrepRoom, type SavePrepResult } from '@/modules/prepare/prep';
import { uploadFloorPlan, deleteFloorPlan } from '@/modules/storage/floor-plan';

/**
 * Prep-pack actions.
 *
 * Thin adapters, as everywhere else: validation and ownership live in the
 * modules. Note what none of these take — a `briefId`. The brief is resolved
 * from the session or the anonymous cookie on the server every time, because an
 * id in a form field is a request to write to somebody else's brief.
 */

export async function saveRoomAction(
  roomKey: string,
  patch: { shuffle?: number; chosenOption?: number | null; note?: string; items?: string[] },
): Promise<SavePrepResult> {
  const result = await savePrepRoom(roomKey, patch);
  // No `revalidatePath` on success. The page holds this state in React and
  // re-rendering the server component underneath a half-typed note would take
  // the cursor out of the textarea.
  return result;
}

export type PlanUploadState =
  | { status: 'idle' }
  | { status: 'saved'; name: string }
  | { status: 'error'; error: string };

/**
 * The floor plan, and the carpet area alongside it.
 *
 * These are one action rather than two because they are one promise: the page
 * says a plan plus the real area tightens the band from X to Y, and the
 * estimator only delivers that when it has both. Splitting them would let
 * somebody upload a plan, skip the area, and be shown a number we then did not
 * produce.
 */
export async function uploadPlanAction(
  _prev: PlanUploadState,
  formData: FormData,
): Promise<PlanUploadState> {
  const file = formData.get('plan');
  const areaRaw = String(formData.get('carpetAreaSqft') ?? '').trim();

  const brief = await ownBriefId();
  if (!brief) {
    return { status: 'error', error: 'We could not find your brief on this device.' };
  }

  // Area first. It is the half that does most of the work, and a rejected file
  // should not throw away a number they typed correctly.
  let carpetAreaSqft: number | null = null;
  if (areaRaw) {
    const parsed = Number(areaRaw);
    if (!Number.isFinite(parsed) || parsed < 150 || parsed > 20000) {
      return { status: 'error', error: 'Carpet area should be somewhere between 150 and 20,000 sqft.' };
    }
    carpetAreaSqft = Math.round(parsed);
  }

  if (!(file instanceof File) || file.size === 0) {
    if (carpetAreaSqft === null) {
      return { status: 'error', error: 'Add a plan, a carpet area, or both.' };
    }
    await prisma.brief.update({ where: { id: brief }, data: { carpetAreaSqft } });
    revalidatePath('/prepare');
    return { status: 'saved', name: `${carpetAreaSqft} sqft` };
  }

  const upload = await uploadFloorPlan(file);
  if (!upload.ok) return { status: 'error', error: upload.error };

  // Replacing a plan orphans the old object. Delete it after the row points at
  // the new one, never before — a failed write with the old file already gone
  // would leave the customer with neither.
  const previous = await prisma.brief.findUnique({
    where: { id: brief },
    select: { floorPlanPath: true },
  });

  await prisma.brief.update({
    where: { id: brief },
    data: {
      floorPlanPath: upload.path,
      floorPlanName: upload.name,
      ...(carpetAreaSqft === null ? {} : { carpetAreaSqft }),
    },
  });

  if (previous?.floorPlanPath && previous.floorPlanPath !== upload.path) {
    await deleteFloorPlan(previous.floorPlanPath);
  }

  revalidatePath('/prepare');
  return { status: 'saved', name: upload.name };
}

async function ownBriefId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) {
    const row = await prisma.brief.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (row) return row.id;
  }
  const anonKey = await readAnonKey();
  if (!anonKey) return null;
  const row = await prisma.brief.findUnique({ where: { anonKey }, select: { id: true } });
  return row?.id ?? null;
}
