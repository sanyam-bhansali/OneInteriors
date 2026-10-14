import 'server-only';

/**
 * The bin really empties (Studio OS Phase 1; the lead audit): the bin screen
 * has always promised "erased after 30 days", and nothing did it. The daily
 * cron (app/api/cron/bin-purge) erases every lead deleted more than
 * `BIN_DAYS` ago, across all studios: their stored files first (the
 * `lead-files` objects), then the rows — the lead, its timeline and its file
 * rows go together (ON DELETE CASCADE).
 *
 * A lead with quotations or projects can never be binned (clients.ts
 * `binClients`), so nothing it erases is referenced elsewhere. Files whose
 * storage could not be erased keep their lead for the next run, rather than
 * leaving a file nobody can find.
 */

import { prisma } from '@/lib/prisma';
import { removeLeadFiles } from '@/modules/storage/lead-files';
import { purgeCutoff } from './intake-rules';

export interface PurgeRun {
  erased: number;
  files: number;
  keptForRetry: number;
}

export async function purgeBin(now = new Date()): Promise<PurgeRun> {
  const cutoff = purgeCutoff(now);
  // Cross-studio by design: every studio's bin, by the same thirty days.
  const due = await prisma.studioClient.findMany({
    where: { deletedAt: { not: null, lte: cutoff }, isDemo: false },
    select: { id: true, studioId: true, files: { select: { storagePath: true } } },
    take: 1000,
  });
  let erased = 0;
  let files = 0;
  let keptForRetry = 0;
  for (const lead of due) {
    const paths = lead.files.map((f) => f.storagePath);
    if (paths.length > 0 && !(await removeLeadFiles(paths))) {
      keptForRetry += 1;
      continue;
    }
    const { count } = await prisma.studioClient.deleteMany({
      where: { id: lead.id, studioId: lead.studioId, deletedAt: { not: null, lte: cutoff } },
    });
    erased += count;
    files += count > 0 ? paths.length : 0;
  }
  return { erased, files, keptForRetry };
}
