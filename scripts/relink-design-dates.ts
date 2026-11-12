/**
 * Running projects catch up with steps done early (owner, 12 Nov 2026:
 * "Final design approval was completed on 12 nov then why is the site visit
 * with electrician shows 22 nov it should change according to the last task
 * completed date").
 *
 *     npx tsx --conditions=react-server scripts/relink-design-dates.ts --studio <slug> --dry-run
 *     npx tsx --conditions=react-server scripts/relink-design-dates.ts --studio <slug>
 *
 * For each running project in design (not on hold): its last ticked design
 * step, if it was done before its planned day, brings every later open step
 * forward by those days (gaps kept, never before today), and the design's
 * end, later stages and handover with them, filed as rescheduled (never
 * anyone's delay). The same rule a tick now follows (step-settle.ts
 * `shiftAfterLateTick`, side EARLY). Steps done late are left as they are.
 * Once per step: a step whose early tick (or an earlier run) already
 * brought the plan forward is skipped, so running it twice moves nothing.
 *
 * The database is DATABASE_URL from the environment; this script loads no
 * .env file. The host is printed first, never the credentials.
 */

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
    console.error('Usage: npx tsx --conditions=react-server scripts/relink-design-dates.ts --studio <slug> [--dry-run]');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Point it at the database to write.');
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]}${dryRun ? '   (DRY RUN: nothing is written)' : ''}`);
  const { prisma } = await import('../src/lib/prisma');
  const { dayFromDb, istDay } = await import('../src/modules/project/working-days');
  const { earlyTickShift } = await import('../src/modules/studio-design/rules');
  const { shiftAfterLateTick } = await import('../src/modules/studio-design/step-settle');
  const now = new Date();
  const today = istDay(now);
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) throw new Error(`No studio with slug "${slug}".`);
    const owner = await prisma.studioMember.findFirst({ where: { studioId: studio.id, isOwner: true, status: 'ACTIVE' }, select: { userId: true } });
    if (!owner) throw new Error('The studio has no active owner to record this as.');
    console.log(`${studio.tradeName} (${slug}) · today ${today}\n`);
    const projects = await prisma.homeProject.findMany({
      where: { cancelledAt: null, introduction: { studioId: studio.id }, holds: { none: { status: 'ON' } }, stages: { some: { kind: 'DESIGN', actualEnd: null } } },
      select: {
        id: true,
        introduction: { select: { brief: { select: { contactName: true } } } },
        stages: { where: { kind: 'DESIGN' }, take: 1, select: { items: { where: { inScope: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, label: true, plannedOn: true, doneAt: true } } } },
      },
    });
    let moved = 0;
    for (const p of projects) {
      const client = p.introduction.brief.contactName?.trim() || p.id;
      const items = p.stages[0]?.items ?? [];
      const lastDone = [...items].reverse().find((i) => i.doneAt && i.plannedOn);
      if (!lastDone) continue;
      // Once per step: skip one whose early tick (or an earlier run) already brought the plan forward.
      const already = await prisma.homeProjectEvent.findMany({ where: { projectId: p.id, type: { in: ['date.moved', 'design.ticked'] } }, select: { type: true, refId: true, payload: true } });
      const done = already.some((e) => {
        const o = (e.payload ?? {}) as { stepId?: unknown; side?: unknown; reason?: unknown };
        return (e.type === 'date.moved' && o.stepId === lastDone.id && o.reason === 'OTHER') || (e.type === 'design.ticked' && e.refId === lastDone.id && o.side === 'EARLY');
      });
      if (done) continue;
      const doneDay = istDay(lastDone.doneAt!);
      const steps = items.map((i) => ({ id: i.id, plannedOn: i.plannedOn ? dayFromDb(i.plannedOn) : null, done: i.doneAt !== null && i.id !== lastDone.id }));
      const shift = earlyTickShift(steps, lastDone.id, doneDay, today);
      if (shift.days === 0) continue;
      moved += 1;
      const next = shift.moves[0]!;
      const nextLabel = items.find((i) => i.id === next.id)?.label ?? 'next step';
      console.log(`${client.padEnd(26)} last done "${lastDone.label}" ${doneDay} (planned ${dayFromDb(lastDone.plannedOn!)}) → ${-shift.days} day${shift.days === -1 ? '' : 's'} forward · "${nextLabel}" ${next.from} → ${next.to} · ${shift.moves.length} step${shift.moves.length === 1 ? '' : 's'}`);
      if (dryRun) continue;
      await prisma.$transaction((tx) =>
        shiftAfterLateTick(tx, { projectId: p.id, stepId: lastDone.id, label: lastDone.label, side: 'EARLY', today, doneDay, byId: owner.userId, actor: { type: 'STUDIO', id: owner.userId }, now }),
      );
    }
    console.log(`\n${moved} of ${projects.length} projects in design ${dryRun ? 'would come' : 'came'} forward.${dryRun ? ' Dry run: nothing was written.' : ''}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
