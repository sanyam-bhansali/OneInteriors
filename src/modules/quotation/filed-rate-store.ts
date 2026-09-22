import 'server-only';

/**
 * Turning a read archive into rates, and holding them until a person agrees.
 *
 * ## The whole path, and where each part lives
 *
 *   files → `extract-agent.ts` → rows
 *   rows  → `ingestQuotations()` (pure, tested, unchanged) → FiledRate[]
 *   rates → here, as PENDING
 *   PENDING → ops → LIVE → `first-quote.ts` prices with them
 *
 * The arithmetic that decides a price stays in `ingest.ts`, which has no I/O
 * and a test file. This module is plumbing and a policy: nothing becomes LIVE
 * without a person, and a rate that is superseded is kept rather than
 * deleted.
 */

import { prisma } from '@/lib/prisma';
import { toDb, fromDb, type Paise } from '@/lib/money';
import { requireRole, getCurrentUser } from '@/modules/auth/session';
import { ingestQuotations } from './ingest';
import { extractArchive } from './extract-agent';
import type { StudioRates } from './catalogue';
import { confidenceOf } from './analysis-states';
import type { FiledRateView } from './analysis-states';

/**
 * Read an archive and file what it yields, as PENDING.
 *
 * ## Never throws
 *
 * It runs in the background after an upload, where a throw is an unhandled
 * rejection in a serverless function and the studio is told nothing. Every
 * failure lands in `analysisState` and `analysisError`, which is where ops
 * looks and where the studio's own status line is read from.
 *
 * ## Idempotent by supersession, not by skipping
 *
 * Running it twice on the same archive does not double the rates: the
 * existing PENDING rows for that archive are superseded first. Running it
 * after ops has already approved rates supersedes those too, which is
 * correct — a re-read means we now believe something different, and the old
 * figure stays in the table so a quote already shown can still be explained.
 */
export async function analyseArchive(archiveId: string): Promise<void> {
  const archive = await prisma.quotationArchive.findUnique({
    where: { id: archiveId },
    select: { id: true, studioId: true },
  });
  if (!archive) return;

  try {
    await prisma.quotationArchive.update({
      where: { id: archiveId },
      data: { analysisState: 'READING', analysisError: null },
    });

    const result = await extractArchive(archiveId);

    if (!result.ok) {
      await prisma.quotationArchive.update({
        where: { id: archiveId },
        data: {
          /* UNAVAILABLE and FAILED are different facts and the studio is told
             different things: one is our deployment, the other is their
             documents. Collapsing them would have a studio re-scanning files
             that were never the problem. */
          analysisState: result.error.includes('No API key') ? 'UNAVAILABLE' : 'FAILED',
          analysisError: result.error,
          analysedAt: new Date(),
        },
      });
      return;
    }

    const { rates, report } = ingestQuotations(
      result.check.quotations,
      new Date().toISOString().slice(0, 10),
    );

    await fileRates(archive.studioId, archiveId, rates);

    await prisma.quotationArchive.update({
      where: { id: archiveId },
      data: {
        analysisState: 'READ',
        analysedAt: new Date(),
        analysisError: null,
        quotationCount: result.check.quotations.length,
        /* The IngestReport kept whole, plus what the extractor could not
           read. Stored rather than recomputed because it is evidence: which
           rate came from how many quotations, and which product strings we
           could not place. When a studio disputes a number a year from now,
           this is the answer. */
        report: {
          ...report,
          filesRead: result.filesRead,
          filesSkipped: result.filesSkipped,
          extractionIssues: result.check.issues,
        } as never,
      },
    });
  } catch (error) {
    await prisma.quotationArchive
      .update({
        where: { id: archiveId },
        data: {
          analysisState: 'FAILED',
          analysisError: error instanceof Error ? error.name : 'unknown',
          analysedAt: new Date(),
        },
      })
      .catch(() => {
        /* The database is the thing that failed. Nothing further to try. */
      });
  }
}

/** Replace this archive's pending rates with a freshly derived set. */
async function fileRates(
  studioId: string,
  archiveId: string,
  rates: StudioRates,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.studioFiledRate.updateMany({
      where: { archiveId, state: 'PENDING' },
      data: { state: 'SUPERSEDED' },
    });

    const rows = Object.values(rates);
    if (rows.length === 0) return;

    await tx.studioFiledRate.createMany({
      data: rows.map((rate) => ({
        studioId,
        archiveId,
        code: rate.code,
        ratePaise: toDb(rate.ratePaise),
        fromQuotations: rate.fromQuotations,
        spec: rate.spec ?? null,
      })),
    });
  });
}

// ── Reading ────────────────────────────────────────────────────

/* Re-exported so server callers have one import for the whole feature; the
   shape itself lives in the pure module so client components can reach it. */
export type { FiledRateView } from './analysis-states';

/**
 * The rates in force for a studio, for the quoting engine.
 *
 * LIVE only. A pending rate is a proposal and must never price anything, and
 * the partial unique index means there is at most one live row per item.
 */
export async function liveRatesFor(studioId: string): Promise<StudioRates> {
  const rows = await prisma.studioFiledRate.findMany({
    where: { studioId, state: 'LIVE' },
  });

  const out: StudioRates = {};
  for (const row of rows) {
    out[row.code] = {
      code: row.code,
      ratePaise: fromDb(row.ratePaise) as Paise,
      fromQuotations: row.fromQuotations,
      filedOn: row.derivedAt.toISOString().slice(0, 10),
      spec: row.spec ?? undefined,
    };
  }
  return out;
}

/**
 * What the studio sees back. Their own rates, so no role check beyond theirs.
 *
 * ## Why this swallows a database error
 *
 * It took the rates step down with a 500 in production. Code deploys the
 * moment it is pushed; a migration runs when somebody runs it, and in the
 * window between the two this queried a table that did not exist yet. Prisma
 * threw, the throw reached the page render, and a studio filling in their
 * rate card got an application error on a step that had nothing to do with
 * this feature.
 *
 * An empty list is the honest answer to "what have we derived for you" when
 * we cannot ask. The panel then renders its not-started state, which is
 * exactly right, and the six manual boxes underneath keep working — so the
 * step degrades to what it was before this feature existed rather than
 * failing shut.
 *
 * The same reasoning as the `hasDatabase()` guard in `currentStudio`, and the
 * same mistake it was added for: a read on a render path must not be able to
 * take the page with it.
 */
export async function myFiledRates(studioId: string): Promise<FiledRateView[]> {
  try {
    const rows = await prisma.studioFiledRate.findMany({
      where: { studioId, state: { in: ['PENDING', 'LIVE'] } },
      orderBy: [{ state: 'asc' }, { code: 'asc' }],
    });
    return rows.map(view);
  } catch (error) {
    console.error('[rates] myFiledRates failed', error);
    return [];
  }
}

/** Everything ops needs to judge one archive's output. */
export async function ratesForReview(archiveId: string): Promise<FiledRateView[]> {
  await requireRole('OPS');
  const rows = await prisma.studioFiledRate.findMany({
    where: { archiveId, state: 'PENDING' },
    orderBy: { code: 'asc' },
  });
  return rows.map(view);
}

function view(row: {
  id: string;
  code: string;
  ratePaise: bigint;
  fromQuotations: number;
  spec: string | null;
  state: string;
  note: string | null;
}): FiledRateView {
  return {
    id: row.id,
    code: row.code,
    ratePaise: fromDb(row.ratePaise),
    fromQuotations: row.fromQuotations,
    confidence: confidenceOf(row.fromQuotations),
    spec: row.spec,
    state: row.state,
    note: row.note,
  };
}

/**
 * Ops asks for an archive to be read again.
 *
 * ## Why a retry is needed at all
 *
 * Extraction fails on things nobody can predict: a scan at an angle, a
 * password-protected export, a batch that hit the API while it was having a
 * bad minute. Without this the only way back was asking the studio to upload
 * the same twenty documents a second time, which is both insulting and the
 * thing most likely to lose them.
 *
 * ## The role check is here, not at the caller
 *
 * `analyseArchive` takes an archive id and no session — it is called from the
 * studio upload path where `currentStudio()` has already established whose
 * archive it is. Reached by id from an ops screen, nothing else would scope
 * it, so the guard belongs next to the write rather than in the action. An
 * action is a route by another name.
 *
 * ## Marking it READING before the work starts
 *
 * So the screen changes the moment the button is pressed. `analyseArchive`
 * sets the same state again when it begins, which is harmless and means a
 * press whose background work never ran leaves the archive in a state that
 * can simply be pressed again.
 */
export async function requestReanalysis(archiveId: string): Promise<ReviewResult> {
  await requireRole('OPS');

  const archive = await prisma.quotationArchive.findUnique({
    where: { id: archiveId },
    select: { id: true, _count: { select: { files: true } } },
  });
  if (!archive) return { ok: false, error: 'That archive is not there any more.' };
  if (archive._count.files === 0) {
    return { ok: false, error: 'There are no files on this archive to read.' };
  }

  await prisma.quotationArchive.update({
    where: { id: archiveId },
    data: { analysisState: 'READING', analysisError: null },
  });

  return { ok: true, live: 0 };
}

// ── Ops decisions ──────────────────────────────────────────────

export type ReviewResult = { ok: true; live: number } | { ok: false; error: string };

/**
 * Put a set of derived rates into force.
 *
 * ## Why the whole archive at once rather than a rate at a time
 *
 * Because a half-approved archive prices a home from two different readings.
 * The comparison screen puts studios side by side on identical lines, and a
 * studio whose kitchen came from this archive and whose wardrobe came from
 * one eighteen months ago is being compared on a blend nobody chose.
 *
 * Ops can still reject individual rates first — `rejectRate` — and then
 * approve what is left. What cannot happen is approving half and forgetting.
 */
export async function approveRates(archiveId: string): Promise<ReviewResult> {
  await requireRole('OPS');
  const user = await getCurrentUser();

  const pending = await prisma.studioFiledRate.findMany({
    where: { archiveId, state: 'PENDING' },
    select: { id: true, studioId: true, code: true },
  });
  if (pending.length === 0) return { ok: false, error: 'Nothing pending on this archive.' };

  const studioId = pending[0]!.studioId;
  const codes = pending.map((p) => p.code);

  await prisma.$transaction(async (tx) => {
    /* The rate these replace. Superseded rather than deleted: an existing
       quote was built on it, and a figure a customer has already been shown
       must stay explicable. */
    await tx.studioFiledRate.updateMany({
      where: { studioId, code: { in: codes }, state: 'LIVE' },
      data: { state: 'SUPERSEDED' },
    });

    await tx.studioFiledRate.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { state: 'LIVE', reviewedAt: new Date(), reviewedById: user?.id ?? null },
    });

    await tx.quotationArchive.update({
      where: { id: archiveId },
      data: { state: 'FILED', reviewedAt: new Date() },
    });
  });

  return { ok: true, live: pending.length };
}

/**
 * Refuse one rate, with a reason the studio reads.
 *
 * Per rate rather than per archive, because that is how the failures come:
 * nineteen good rates and a mandir read off three quotes, one of which was
 * for a temple room the size of a bedroom.
 */
export async function rejectRate(id: string, note: string): Promise<ReviewResult> {
  await requireRole('OPS');
  const user = await getCurrentUser();

  const trimmed = note.trim();
  if (trimmed.length < 10) {
    return {
      ok: false,
      error: 'Say why in a sentence — the studio reads this, and "rejected" tells them nothing.',
    };
  }

  const row = await prisma.studioFiledRate.findFirst({
    where: { id, state: 'PENDING' },
    select: { id: true },
  });
  if (!row) return { ok: false, error: 'That rate is not pending any more.' };

  await prisma.studioFiledRate.update({
    where: { id },
    data: {
      state: 'REJECTED',
      note: trimmed.slice(0, 500),
      reviewedAt: new Date(),
      reviewedById: user?.id ?? null,
    },
  });

  return { ok: true, live: 0 };
}
