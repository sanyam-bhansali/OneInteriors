/**
 * Build the plan, once, for every customer project signed before signing
 * built one (studio workspace Phase 1).
 *
 *     npx tsx scripts/studio/build-plans.ts            # dry run: says what it would write
 *     npx tsx scripts/studio/build-plans.ts --apply    # writes it
 *
 * Run it after the migration 20261011140000_studio_workspace_foundation is
 * applied. Projects that already have a plan are skipped, so it is safe to
 * run again. What it builds, and from what, is in
 * src/modules/portal/plan-backfill.ts.
 */

import '../../prisma/load-env';
import { PrismaClient } from '@prisma/client';
import { backfillPlans } from '../../src/modules/portal/plan-backfill';

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const lines = await backfillPlans(prisma, { apply });
    if (lines.length === 0) {
      console.log('Every project already has a plan. Nothing to do.');
      return;
    }
    for (const l of lines) {
      console.log(
        [
          l.projectId,
          l.source === 'quote' ? 'from the signed quote' : 'from the tracker',
          `${l.stages} stages`,
          `${l.items} checklist items`,
          `${l.materials} materials`,
          `${l.doneStages} already done`,
          l.filesDocuments ? 'files agreement + quotation' : 'no documents to file',
          apply ? (l.written ? 'WRITTEN' : 'skipped (already had a plan)') : 'dry run',
        ].join(' · '),
      );
    }
    console.log(
      apply
        ? `\n${lines.filter((l) => l.written).length} of ${lines.length} projects given a plan.`
        : `\n${lines.length} projects need a plan. Run again with --apply to write them.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
