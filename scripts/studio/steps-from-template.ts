/**
 * Replace the checklist generated from the quote with Hauspire's steps, once,
 * on every project that still has it (the step tracker,
 * docs/studio-workspace/STEP-TRACKER.md).
 *
 *     npx tsx scripts/studio/steps-from-template.ts            # dry run: says what it would change
 *     npx tsx scripts/studio/steps-from-template.ts --apply    # writes it
 *
 * Run it after the migration 20261011170000_step_tracker is applied.
 * Projects already on steps are skipped, so it is safe to run again. Stages
 * already done get their steps ticked (no photo, marked BACKFILL). What it
 * does, and what it drops, is in src/modules/portal/steps-backfill.ts.
 */

import '../../prisma/load-env';
import { PrismaClient } from '@prisma/client';
import { stepsFromTemplate } from '../../src/modules/portal/steps-backfill';

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const lines = await stepsFromTemplate(prisma, { apply });
    if (lines.length === 0) {
      console.log('Every project with a plan is already on steps. Nothing to do.');
      return;
    }
    for (const l of lines) {
      console.log(
        [
          l.projectId,
          `${l.oldItems} generated items out`,
          l.tickedFromPosts ? `${l.tickedFromPosts} of them ticked in site posts (their "Done" line leaves those posts; photos stay)` : 'none ticked in a site post',
          `${l.steps} steps in`,
          `${l.tickedSteps} ticked (stage already done)`,
          apply ? (l.written ? 'WRITTEN' : 'skipped (already on steps)') : 'dry run',
        ].join(' · '),
      );
    }
    console.log(
      apply
        ? `\n${lines.filter((l) => l.written).length} of ${lines.length} projects moved to steps.`
        : `\n${lines.length} projects would move to steps. Run again with --apply to write them.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
