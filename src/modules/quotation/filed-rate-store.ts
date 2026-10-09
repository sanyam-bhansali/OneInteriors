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
import { requireRole, getCurrentUser, hasRole } from '@/modules/auth/session';
import { myStudioId } from '@/modules/studio/tenancy';
import { ingestQuotations } from './ingest';
import { readNextBatch, EMPTY_PROGRESS, type ReadProgress } from './extract-agent';
import { MIN_QUOTATIONS_PER_ITEM, rateCanGoLive, type StudioRates } from './catalogue';
import { confidenceOf } from './analysis-states';
import type { FiledRateView } from './analysis-states';
import { productsFromArchive, bridgeSummary } from '@/modules/studio-quote/from-archive';

/**
 * Read the next batch of an archive, and file the rates once the last batch is in.
 *
 * ## Ops presses it; nothing reads on upload any more
 *
 * Reading costs money per document, so it starts only when a person asks:
 * ops opens the archive, presses Read, and the screen calls this once per
 * batch until it reports done — or until ops presses Stop. Upload only
 * stores the files.
 *
 * ## One batch per call
 *
 * See `readNextBatch`. What was read so far lives in `report.progress` on the
 * archive, so a stopped or interrupted read carries on from where it was,
 * and a read never runs longer than one request to the reader.
 *
 * ## Idempotent by supersession, not by skipping
 *
 * When the last batch is in, the archive's PENDING rates are replaced, not
 * added to. `fresh: true` starts again from the first file — the "read them
 * again" case — and discards the stored progress.
 */
export type BatchOutcome =
  | { ok: true; done: boolean; read: number; total: number; filed: number | null; skipped: number }
  | { ok: false; error: string };

export async function readArchiveBatch(archiveId: string, fresh = false): Promise<BatchOutcome> {
  await requireRole('OPS');

  const archive = await prisma.quotationArchive.findUnique({
    where: { id: archiveId },
    select: { id: true, studioId: true, report: true },
  });
  if (!archive) return { ok: false, error: 'That archive is not there any more.' };

  const stored = (archive.report as { progress?: ReadProgress } | null)?.progress;
  const before: ReadProgress = !fresh && stored && typeof stored.cursor === 'number' ? stored : EMPTY_PROGRESS;

  try {
    await prisma.quotationArchive.update({
      where: { id: archiveId },
      data: { analysisState: 'READING', analysisError: null },
    });

    const result = await readNextBatch(archiveId, before);

    if (!result.ok) {
      await prisma.quotationArchive.update({
        where: { id: archiveId },
        data: {
          analysisState: result.error.includes('No API key') ? 'UNAVAILABLE' : 'FAILED',
          analysisError: result.error,
          analysedAt: new Date(),
        },
      });
      return { ok: false, error: result.error };
    }

    if (!result.done) {
      /* Partway. The progress is saved so the next press — or the next
         visit, if ops stops here — continues rather than starting over. */
      await prisma.quotationArchive.update({
        where: { id: archiveId },
        data: { report: { progress: result.progress } as never },
      });
      return {
        ok: true,
        done: false,
        read: result.progress.cursor,
        total: result.total,
        filed: null,
        skipped: result.progress.skipped.length,
      };
    }

    if (result.check.quotations.length === 0) {
      await prisma.quotationArchive.update({
        where: { id: archiveId },
        data: {
          analysisState: 'FAILED',
          analysisError: 'Nothing readable came back. Ops reads these by hand.',
          analysedAt: new Date(),
          report: { progress: result.progress } as never,
        },
      });
      return { ok: false, error: 'Nothing readable came back from these files.' };
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
           this is the answer. The raw progress is dropped — it has served
           its purpose and it is the largest thing on the row. */
        report: {
          ...report,
          filesRead: result.progress.filesRead,
          filesSkipped: result.progress.skipped,
          extractionIssues: result.check.issues,
        } as never,
      },
    });

    return {
      ok: true,
      done: true,
      read: result.total,
      total: result.total,
      filed: Object.keys(rates).length,
      skipped: result.progress.skipped.length,
    };
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
    return { ok: false, error: 'The read stopped on our side. Press Read to carry on from where it was.' };
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
  /**
   * An empty set is a meaningful answer here, and a throw is not.
   *
   * The caller's whole job is choosing between a studio's filed rates and the
   * placeholder table, so "I could not read the filed ones" has a correct
   * response — use the placeholder — and it is the caller who should make it.
   * `myFiledRates` next door has said exactly this for a while; this one was
   * on the pricing path and had no such protection, which took `/match` down
   * with it.
   */
  const rows = await prisma.studioFiledRate
    .findMany({
      where: { studioId, state: 'LIVE' },
      /* One LIVE row per catalogue item is the invariant (a partial unique
         index enforces it), so this can never legitimately exceed the
         catalogue. The cap is what stops a broken invariant becoming an
         unbounded read on the pricing path. */
      take: 200,
    })
    .catch((error: unknown) => {
      console.error('[rates] liveRatesFor failed, falling back', studioId, error);
      return [];
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
  /**
   * Checked here, not trusted from the caller.
   *
   * This took a studioId as a parameter with no authorisation of its own, in
   * a file that also exports OPS-guarded functions — so it read as though it
   * were one of them. Every caller passes the session's own studio today; the
   * check is what keeps that true when somebody adds the twentieth caller.
   *
   * Ops pass through, because reviewing these is their job.
   */
  const mine = await myStudioId();
  if (mine !== studioId) {
    const user = await getCurrentUser();
    if (!hasRole(user, 'OPS') && !hasRole(user, 'ADMIN')) return [];
  }

  try {
    const rows = await prisma.studioFiledRate.findMany({
      where: { studioId, state: { in: ['PENDING', 'LIVE'] } },
      orderBy: [{ state: 'asc' }, { code: 'asc' }],
      /* Two states across a 23-item catalogue. Anything approaching this cap
         means the state machine has stopped superseding, which is worth
         finding out about from a truncated screen rather than from a slow
         one. */
      take: 100,
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
    // One archive yields at most one rate per catalogue item.
    take: 100,
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

// ── Ops decisions ──────────────────────────────────────────────

export type ReviewResult =
  | { ok: true; live: number; catalogue: string | null }
  | { ok: false; error: string };

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
    select: { id: true, studioId: true, code: true, ratePaise: true, fromQuotations: true, spec: true },
  });
  if (pending.length === 0) return { ok: false, error: 'Nothing pending on this archive.' };

  const studioId = pending[0]!.studioId;
  /* The per-item floor. A rate from fewer than MIN_QUOTATIONS_PER_ITEM
     quotations is set aside with a note rather than put in force — the quote
     then names that item as not filed, which is true, instead of pricing it
     off a median of three. */
  const going = pending.filter((p) => rateCanGoLive(p.fromQuotations));
  const held = pending.filter((p) => !rateCanGoLive(p.fromQuotations));
  const codes = going.map((p) => p.code);

  await prisma.$transaction(async (tx) => {
    /* The rate these replace. Superseded rather than deleted: an existing
       quote was built on it, and a figure a customer has already been shown
       must stay explicable. */
    await tx.studioFiledRate.updateMany({
      where: { studioId, code: { in: codes }, state: 'LIVE' },
      data: { state: 'SUPERSEDED' },
    });

    await tx.studioFiledRate.updateMany({
      where: { id: { in: going.map((p) => p.id) } },
      data: { state: 'LIVE', reviewedAt: new Date(), reviewedById: user?.id ?? null },
    });

    if (held.length > 0) {
      await tx.studioFiledRate.updateMany({
        where: { id: { in: held.map((p) => p.id) } },
        data: {
          state: 'REJECTED',
          note: `Fewer than ${MIN_QUOTATIONS_PER_ITEM} of your quotations price this — send more that include it and it will be priced.`,
          reviewedAt: new Date(),
          reviewedById: user?.id ?? null,
        },
      });
    }

    await tx.quotationArchive.update({
      where: { id: archiveId },
      data: { state: 'FILED', reviewedAt: new Date() },
    });
  });

  /**
   * The same rates, into their own product master.
   *
   * Outside the transaction above, and deliberately. What that transaction
   * protects is the thing customers are quoted on — half a set of live rates
   * would price one home from two readings. The product master is the
   * studio's own working catalogue: filling it is a convenience, and a
   * failure there must not roll back an approval ops has just made.
   *
   * So it runs after, it reports rather than throws, and the worst case is a
   * studio typing rates we could have filled in — which is exactly where they
   * were before this existed.
   */
  const catalogue = await fillProductMaster(studioId, pending);

  /* Tell the studio their rates are in and need checking. In-app, read on the
     dashboard and Product master; cleared when they confirm. Outside the
     transaction for the same reason the product master is: a notice failing
     to write must not undo an approval. */
  if (going.length > 0) {
    await prisma.studioMember
      .findMany({ where: { studioId }, select: { userId: true } })
      .then((members) =>
        members.length === 0
          ? null
          : prisma.notification.createMany({
              data: members.map((m) => ({
                userId: m.userId,
                channel: 'push',
                template: 'rates.filled',
                payload: { archiveId, live: going.length },
              })),
            }),
      )
      .catch((error) => console.error('[filed-rates] rates.filled notice failed', error));
  }

  return { ok: true, live: going.length, catalogue };
}

/**
 * Fill the studio's CRM product master from what was just approved.
 *
 * Returns a sentence for ops, or null if nothing could be written. The rules
 * — create what is missing, price what is blank, never touch a rate the
 * studio typed — are all in `from-archive.ts`, which is pure and tested.
 */
async function fillProductMaster(
  studioId: string,
  approved: { code: string; ratePaise: bigint; fromQuotations: number; spec: string | null }[],
): Promise<string | null> {
  try {
    const existing = await prisma.studioProduct.findMany({
      where: { studioId },
      select: { id: true, name: true, ratePaise: true },
    });

    const result = productsFromArchive(
      approved.map((r) => ({
        code: r.code,
        ratePaise: fromDb(r.ratePaise),
        fromQuotations: r.fromQuotations,
        spec: r.spec,
      })),
      existing.map((p) => ({ id: p.id, name: p.name, ratePaise: fromDb(p.ratePaise) })),
    );

    if (result.unknownCodes.length > 0) {
      /* Loud, because it means the catalogue and the extractor have drifted:
         a rate we can quote a customer on but cannot put in the studio's own
         list is a quotation they could not reproduce. */
      console.error('[filed-rates] codes with no catalogue item', result.unknownCodes);
    }

    if (result.create.length === 0 && result.priceExisting.length === 0) {
      return bridgeSummary(result);
    }

    await prisma.$transaction([
      ...(result.create.length > 0
        ? [
            prisma.studioProduct.createMany({
              data: result.create.map((p) => ({
                studioId,
                name: p.name,
                code: p.code,
                unit: p.unit,
                details: p.details,
                ratePaise: toDb(p.ratePaise),
                rooms: p.rooms as string[],
                defaultWidthMm: p.defaultWidthMm,
                defaultHeightMm: p.defaultHeightMm,
                defaultQty: p.defaultQty,
                sortOrder: p.sortOrder,
                /* Derived from their own documents, so by definition part of
                   what they fit as standard. They can untick any of it. */
                inStandardBuild: true,
              })),
              /* Against the (studioId, name) unique index. A race with the
                 studio adding the same product by hand should skip, not
                 fail an approval. */
              skipDuplicates: true,
            }),
          ]
        : []),
      ...result.priceExisting.map((p) =>
        prisma.studioProduct.update({
          where: { id: p.id },
          data: { ratePaise: toDb(p.ratePaise), inStandardBuild: true },
        }),
      ),
    ]);

    return bridgeSummary(result);
  } catch (error) {
    console.error('[filed-rates] fillProductMaster failed', error);
    return null;
  }
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

  return { ok: true, live: 0, catalogue: null };
}
