import 'server-only';

/**
 * Reading and writing a studio's quotation archive.
 *
 * The rules live next door in `quotation-archive.ts` with no `server-only` so
 * they can be tested; this file is the database and storage half.
 */

import { prisma } from '@/lib/prisma';
import { after } from 'next/server';
import { analyseArchive } from '@/modules/quotation/filed-rate-store';
import { requireRole } from '@/modules/auth/session';
import { currentStudio } from './onboarding';
import {
  storeQuotationFile,
  deleteQuotationFiles,
  signedUrlForFile,
  MAX_FILES_PER_UPLOAD,
  quotationUploadEnabled,
} from '@/modules/storage/quotation-archive';
import type { ArchiveState, ArchiveSummary } from './quotation-archive';

export interface ArchiveDetail extends ArchiveSummary {
  /**
   * What the automatic reader has done with this archive.
   *
   * A separate axis from `state`, which is what OPS has done. They move
   * independently and the normal case needs both — read by the machine and
   * still waiting on a person. See `quotation/analysis-states.ts`.
   */
  analysisState: string;
  /** For ops, not the studio. Extraction fails in ways worth reading. */
  analysisError: string | null;
  id: string;
  uploadedAt: string;
  files: { id: string; filename: string; bytes: number; path: string }[];
}

function toDetail(row: {
  id: string;
  state: string;
  /** What the automatic reader has done. Separate axis — see analysis-states.ts. */
  analysisState: string;
  analysisError: string | null;
  quotationCount: number | null;
  note: string | null;
  uploadedAt: Date;
  files: { id: string; filename: string; bytes: number; path: string }[];
}): ArchiveDetail {
  return {
    id: row.id,
    state: row.state as ArchiveState,
    analysisState: row.analysisState,
    analysisError: row.analysisError,
    quotationCount: row.quotationCount,
    note: row.note,
    fileCount: row.files.length,
    uploadedAt: row.uploadedAt.toISOString(),
    files: row.files,
  };
}

const WITH_FILES = {
  files: {
    select: { id: true, filename: true, bytes: true, path: true },
    orderBy: { uploadedAt: 'asc' },
  },
} as const;

/** The signed-in studio's most recent archive, or null if they never sent one. */
export async function myArchive(): Promise<ArchiveDetail | null> {
  const context = await currentStudio();
  if (!context) return null;

  /* Guarded for the same reason `myFiledRates` is: this row gained columns
     in a migration, and between a push and that migration running, selecting
     them throws and takes the whole rates step down with a 500. Null is what
     "no archive" already means everywhere that calls this, so the page
     degrades to the state it had before rather than failing shut. */
  try {
    const row = await prisma.quotationArchive.findFirst({
      where: { studioId: context.studio.id },
      orderBy: { uploadedAt: 'desc' },
      include: WITH_FILES,
    });

    return row ? toDetail(row) : null;
  } catch (error) {
    console.error('[archive] myArchive failed', error);
    return null;
  }
}

/** Every archive a given studio has sent. Ops only. */
export async function archivesForStudio(studioId: string): Promise<ArchiveDetail[]> {
  await requireRole('OPS');

  const rows = await prisma.quotationArchive.findMany({
    where: { studioId },
    orderBy: { uploadedAt: 'desc' },
    include: WITH_FILES,
    /* A studio files an archive every few months, so a hundred is a decade of
       history and more than any screen shows. The cap is not about today's
       volume — it is that this read carries every FILE row of every archive
       with it, so an unbounded version grows quadratically with nothing to
       stop it. */
    take: 100,
  });

  return rows.map(toDetail);
}

export type UploadOutcome =
  | { ok: true; stored: number; skipped: string[] }
  | { ok: false; error: string };

/**
 * Take a batch of files from the signed-in studio.
 *
 * ## Why a partial success is a success
 *
 * One corrupt file out of thirty must not lose the other twenty-nine. A studio
 * who has just spent ten minutes selecting files and watched the whole upload
 * fail on the last one does not try again — so anything that stored is kept,
 * and the ones that did not are named so they can be re-sent or explained.
 *
 * ## Why the rows are written after the objects
 *
 * A row pointing at an object that does not exist is a file ops cannot open
 * and cannot account for. An object with no row is a few kilobytes nobody
 * looks at. Both are failures; only one of them wastes somebody's afternoon.
 */
export async function uploadQuotations(files: File[]): Promise<UploadOutcome> {
  const context = await currentStudio();
  if (!context) return { ok: false, error: 'No studio is linked to this account.' };

  if (!quotationUploadEnabled()) {
    return { ok: false, error: 'Sending files is not switched on yet. Fill the rates in below and we will sort this out with you directly.' };
  }

  const real = files.filter((f) => f && f.size > 0);
  if (real.length === 0) return { ok: false, error: 'No files were selected.' };
  if (real.length > MAX_FILES_PER_UPLOAD) {
    return {
      ok: false,
      error: `That is more than ${MAX_FILES_PER_UPLOAD} files at once. Send them in two goes — a second batch adds to the first, it does not replace it.`,
    };
  }

  const stored: { path: string; filename: string; contentType: string; bytes: number }[] = [];
  const skipped: string[] = [];

  for (const file of real) {
    const result = await storeQuotationFile(context.studio.id, file);
    if (result.ok) stored.push(result.file);
    else skipped.push(result.error);
  }

  if (stored.length === 0) {
    return { ok: false, error: skipped[0] ?? 'Nothing could be stored.' };
  }

  try {
    /* Added to the open archive rather than starting a new one, so a studio
       who sends twelve files today and fifteen tomorrow is one batch of
       twenty-seven to review — not two batches that each look too small.
       A FILED or REJECTED archive is closed; a new batch starts fresh. */
    const open = await prisma.quotationArchive.findFirst({
      where: { studioId: context.studio.id, state: { in: ['RECEIVED', 'READING'] } },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true },
    });

    let archiveId: string;
    if (open) {
      await prisma.quotationFile.createMany({
        data: stored.map((f) => ({ archiveId: open.id, ...f })),
      });
      archiveId = open.id;
    } else {
      const created = await prisma.quotationArchive.create({
        data: { studioId: context.studio.id, files: { create: stored } },
        select: { id: true },
      });
      archiveId = created.id;
    }

    /**
     * Start reading them, without making the studio wait.
     *
     * Twenty documents through the extractor is minutes, not seconds, so it
     * cannot happen inside this request — the upload would time out and the
     * studio would be told their files failed when they are sitting safely
     * in the bucket.
     *
     * `after()` runs once the response is sent. It is best-effort by nature:
     * a cold start killed mid-flight leaves the archive at NOT_STARTED,
     * which is a state ops can see and re-run from, and is exactly where
     * every archive sat before this existed. Nothing is lost by it not
     * running — only time.
     *
     * `analyseArchive` never throws; its failures land in `analysisState`.
     * The `catch` is belt and braces for an unhandled rejection reaching a
     * serverless function, where it would take the instance down.
     */
    after(() => analyseArchive(archiveId).catch(() => {}));
  } catch {
    // The objects are in the bucket but unreferenced. Remove them rather than
    // leaving files nobody can find and nobody can delete.
    await deleteQuotationFiles(stored.map((f) => f.path));
    return { ok: false, error: 'We stored the files but could not record them. Nothing was kept — please try again.' };
  }

  return { ok: true, stored: stored.length, skipped };
}

/**
 * A five-minute link to one stored file, by row id.
 *
 * Takes an **id, never a path.** A path arriving from a browser is an
 * attacker-chosen string pointed at a bucket holding every studio's pricing;
 * an id has to exist in our table before it resolves to anything. The role
 * check happens inside `signedUrlForFile`, which is the one access boundary
 * for that bucket.
 */
export async function signedUrlForArchiveFile(fileId: string): Promise<string | null> {
  await requireRole('OPS');

  const file = await prisma.quotationFile.findUnique({
    where: { id: fileId },
    select: { path: true },
  });
  if (!file) return null;

  return signedUrlForFile(file.path);
}

export type ReviewResult = { ok: true } | { ok: false; error: string };

/**
 * Ops records what they found when they opened the files.
 *
 * `note` is required for a rejection and shown to the studio verbatim, for the
 * same reason the application rejection is: we collect the honesty anyway, and
 * a studio told "we could not use these" with no reason has been given a
 * problem rather than an answer.
 */
export async function reviewArchive(
  archiveId: string,
  state: ArchiveState,
  quotationCount: number | null,
  note: string,
): Promise<ReviewResult> {
  await requireRole('OPS');

  const trimmed = note.trim();
  if (state === 'REJECTED' && trimmed.length < 10) {
    return {
      ok: false,
      error: 'Say why, in a sentence. The studio reads this word for word, and "we could not use these" is not something anybody can act on.',
    };
  }

  if (quotationCount !== null && (!Number.isInteger(quotationCount) || quotationCount < 0)) {
    return { ok: false, error: 'The quotation count has to be a whole number.' };
  }

  try {
    await prisma.quotationArchive.update({
      where: { id: archiveId },
      data: {
        state,
        quotationCount,
        note: trimmed || null,
        reviewedAt: state === 'RECEIVED' ? null : new Date(),
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save that.' };
  }
}
