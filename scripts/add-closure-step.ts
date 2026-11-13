/**
 * Running projects get the "Project closure" step (owner, 13 Nov 2026:
 * "Project closure as an activity should have a place … after the shutters
 * stage, this should happen … it should show in the execution timeline and
 * in the designer's tasks"). New plans have it from the step template
 * (project/step-template.ts `PROJECT_CLOSURE_STEP`); this adds it to the
 * plans made before.
 *
 *     npx tsx --conditions=react-server scripts/add-closure-step.ts --studio <slug> --dry-run
 *     npx tsx --conditions=react-server scripts/add-closure-step.ts --studio <slug>
 *
 * For each project of the studio that is not cancelled and not closed out,
 * with a carpentry stage that is still open (no `actualEnd`; a stage already
 * marked done is left alone, so no client's tracker reopens) and no step of
 * that name yet: one step "Project closure" at the end of the carpentry
 * stage, in the last step's group, planned on the last step's day (else the
 * stage's end), weight 0 so no client's percentage moves on a running
 * project (new plans weigh it 1%). Written with a `step.added` event, as
 * the Plan tab's "Add a step" does. Running it twice adds nothing.
 *
 * The database is DATABASE_URL from the environment; this script loads no
 * .env file. The host is printed first, never the credentials.
 */

export {};

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

async function main() {
  const slug = arg('studio')?.trim();
  const dryRun = process.argv.includes('--dry-run');
  if (!slug) {
    console.error('Usage: npx tsx --conditions=react-server scripts/add-closure-step.ts --studio <slug> [--dry-run]');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Point it at the database to write.');
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]}${dryRun ? '   (DRY RUN: nothing is written)' : ''}`);
  const { prisma } = await import('../src/lib/prisma');
  const { recordEvent } = await import('../src/modules/project/events');
  const { PROJECT_CLOSURE_STEP, isProjectClosureStep } = await import('../src/modules/project/step-template');
  const { closureStepPlacement } = await import('../src/modules/project/closure-due');
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) throw new Error(`No studio with slug "${slug}".`);
    const owner = await prisma.studioMember.findFirst({ where: { studioId: studio.id, isOwner: true, status: 'ACTIVE' }, select: { userId: true } });
    if (!owner) throw new Error('The studio has no active owner to record this as.');
    console.log(`${studio.tradeName} (${slug})\n`);
    const projects = await prisma.homeProject.findMany({
      where: { cancelledAt: null, closedOutAt: null, introduction: { studioId: studio.id } },
      select: {
        id: true,
        introduction: { select: { brief: { select: { contactName: true } } } },
        stages: {
          where: { kind: 'CARPENTRY' },
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { id: true, actualEnd: true, plannedEnd: true, items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, label: true, room: true, sortOrder: true, plannedOn: true } } },
        },
      },
    });
    let added = 0;
    let done = 0;
    let has = 0;
    let none = 0;
    for (const p of projects) {
      const client = p.introduction.brief.contactName?.trim() || p.id;
      const stage = p.stages[0];
      if (!stage) {
        none += 1;
        continue;
      }
      if (stage.items.some((i) => isProjectClosureStep(i.label))) {
        has += 1;
        continue;
      }
      if (stage.actualEnd) {
        done += 1;
        console.log(`${client.padEnd(26)} carpentry already marked done: left alone (add the step by hand on the Plan tab if it is still to come)`);
        continue;
      }
      const at = closureStepPlacement(stage.items.map((i) => ({ room: i.room, sortOrder: i.sortOrder, plannedOn: i.plannedOn })), stage.plannedEnd);
      added += 1;
      console.log(`${client.padEnd(26)} + "${PROJECT_CLOSURE_STEP}" in ${at.group}, planned ${at.plannedOn.toISOString().slice(0, 10)}`);
      if (dryRun) continue;
      await prisma.$transaction(async (tx) => {
        // Checked again inside the transaction, so two runs at once add it once.
        const again = await tx.homeChecklistItem.findFirst({ where: { stageId: stage.id, label: { equals: PROJECT_CLOSURE_STEP, mode: 'insensitive' } }, select: { id: true } });
        if (again) return;
        const made = await tx.homeChecklistItem.create({
          data: { stageId: stage.id, room: at.group, label: PROJECT_CLOSURE_STEP, sortOrder: at.sortOrder, weightBp: 0, inScope: true, plannedOn: at.plannedOn, firstPlannedOn: at.plannedOn },
          select: { id: true },
        });
        await recordEvent(tx, { projectId: p.id, type: 'step.added', actor: { type: 'STUDIO', id: owner.userId }, refId: made.id, payload: { stageId: stage.id, weightBp: 0, by: 'scripts/add-closure-step.ts' } });
      });
    }
    console.log(
      `\n${added} of ${projects.length} running projects ${dryRun ? 'would get' : 'got'} the step · ${has} had it · ${done} with carpentry done, left alone · ${none} with no carpentry stage.${dryRun ? ' Dry run: nothing was written.' : ''}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
