import 'server-only';

/**
 * The documents a studio has sent us, and the two things it can do with them.
 *
 * Every function here resolves the studio from the session itself rather than
 * taking an id. That is the pattern the rest of `studio/` follows and the
 * reason is worth restating: a `studioId` parameter is an authorisation
 * decision moved to the caller, and the caller is a route handler somebody
 * will add in a hurry one day.
 */

import { prisma } from '@/lib/prisma';
import { currentStudio } from './onboarding';
import {
  isDocumentKind,
  type DocumentKind,
  type DocumentState,
} from './document-kinds';
import {
  storeBusinessProof,
  removeBusinessProof,
  proofUploadEnabled,
} from '@/modules/storage/business-proof';

/** What the studio sees back. Deliberately no storage key. */
export interface StudioDocumentView {
  id: string;
  kind: DocumentKind;
  filename: string;
  bytes: number;
  state: DocumentState;
  note: string | null;
  createdAt: string;
}

/**
 * How many a studio may hold at once.
 *
 * Not a rate limit — it is a signal. A studio on its fifteenth upload is not
 * proving anything further; it is usually somebody who could not tell whether
 * the last one worked, which is a problem with the interface rather than with
 * them. The cap makes that visible instead of filling a bucket.
 */
const MAX_LIVE_DOCUMENTS = 6;

export async function myDocuments(): Promise<StudioDocumentView[]> {
  const context = await currentStudio();
  if (!context) return [];

  const rows = await prisma.studioDocument.findMany({
    where: { studioId: context.studio.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((row) => ({
    id: row.id,
    /* A row written before a kind was retired still has to render. Falling
       back to OTHER keeps an unknown value displayable rather than throwing
       on a page whose job is to reassure somebody. */
    kind: isDocumentKind(row.kind) ? row.kind : 'OTHER',
    filename: row.originalName,
    bytes: row.bytes,
    state: (row.state as DocumentState) ?? 'RECEIVED',
    note: row.note,
    /* Serialised here. A Date crossing to a client component is a hydration
       mismatch waiting for a machine in another timezone. */
    createdAt: row.createdAt.toISOString(),
  }));
}

export type UploadResult = { ok: true } | { ok: false; error: string };

/**
 * Take one document from the signed-in studio.
 *
 * ## The order of operations matters
 *
 * The file goes to storage first and the row is written only if that
 * succeeded. The other order — row first, then upload — leaves a row
 * pointing at an object that does not exist whenever storage is having a bad
 * minute, and nothing later can tell that from a file that was deleted. A
 * failed upload with no row is a studio pressing the button again, which is
 * the recoverable failure.
 *
 * If the row write then fails, the object is removed. It is best-effort: a
 * stranded object costs a few kilobytes, and keeping it would be worse than
 * that because nothing would ever reference it again.
 */
export async function uploadBusinessProof(kind: string, file: File): Promise<UploadResult> {
  const context = await currentStudio();
  if (!context) return { ok: false, error: 'No studio is linked to this account.' };

  if (!proofUploadEnabled()) {
    return {
      ok: false,
      error: 'Sending documents is not switched on yet. Email it to us and we will attach it.',
    };
  }

  if (!isDocumentKind(kind)) {
    return { ok: false, error: 'Tell us what the document is first.' };
  }

  const live = await prisma.studioDocument.count({
    where: { studioId: context.studio.id, deletedAt: null },
  });
  if (live >= MAX_LIVE_DOCUMENTS) {
    return {
      ok: false,
      error: `That is ${MAX_LIVE_DOCUMENTS} documents already — more than enough. Remove one if you meant to replace it.`,
    };
  }

  const stored = await storeBusinessProof(context.studio.id, file);
  if (!stored.ok) return { ok: false, error: stored.error };

  try {
    await prisma.studioDocument.create({
      data: {
        studioId: context.studio.id,
        kind,
        storageKey: stored.file.path,
        originalName: stored.file.filename,
        contentType: stored.file.contentType,
        bytes: stored.file.bytes,
      },
    });
  } catch {
    await removeBusinessProof(stored.file.path);
    return { ok: false, error: 'We stored the file but could not record it. Try again.' };
  }

  return { ok: true };
}

/**
 * Withdraw a document.
 *
 * ## Soft on the row, hard on the object
 *
 * The row keeps its `deletedAt` because the fact that a studio sent us
 * something and then took it back is part of the verification record, and a
 * hard delete would make that indistinguishable from never having sent it.
 * The bytes go, because holding somebody's identity document after they have
 * asked us not to is the thing the soft delete must not quietly do.
 *
 * ## Why an accepted document cannot be withdrawn here
 *
 * Once ops has read it and let it count toward verification, removing it
 * silently would leave a tier resting on evidence that is gone. That needs a
 * conversation, so it is refused with one rather than handled.
 */
export async function withdrawDocument(id: string): Promise<UploadResult> {
  const context = await currentStudio();
  if (!context) return { ok: false, error: 'No studio is linked to this account.' };

  /* Scoped by studio in the WHERE, not checked afterwards. An id from a form
     is attacker-controlled, and `findUnique` then compare is the shape that
     forgets the compare. */
  const row = await prisma.studioDocument.findFirst({
    where: { id, studioId: context.studio.id, deletedAt: null },
  });
  if (!row) return { ok: false, error: 'That document is not there any more.' };

  if (row.state === 'ACCEPTED') {
    return {
      ok: false,
      error: 'We have already accepted this one and it counts toward your verification. Talk to us and we will sort it out.',
    };
  }

  await prisma.studioDocument.update({
    where: { id: row.id },
    data: { deletedAt: new Date() },
  });

  await removeBusinessProof(row.storageKey);

  return { ok: true };
}
