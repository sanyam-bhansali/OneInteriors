/**
 * Running projects off Mondays (owner, 13 Nov 2026: "Monday being our weekly
 * off …"; "Yes, fix them"). New plans and every move already skip the
 * studio's days off; this moves the dates planned before that.
 *
 *     npx tsx scripts/snap-day-off-dates.ts --studio <slug> --dry-run
 *     npx tsx scripts/snap-day-off-dates.ts --studio <slug>
 *
 * For each project not cancelled: every open step whose planned day is a day
 * off (a Monday, or a studio holiday) moves to the next working day, and so
 * does its first planned day when it was the same (so it does not read as a
 * move). Every unfinished stage's start and end on a day off move the same
 * way, handover included. Each date moves forward a day or two at most, so
 * the order never changes. A calendar correction, not a delay: no delay or
 * date-change rows. Running it twice moves nothing the second time.
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
    console.error('Usage: npx tsx scripts/snap-day-off-dates.ts --studio <slug> [--dry-run]');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Point it at the database to write.');
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]}${dryRun ? '   (DRY RUN: nothing is written)' : ''}`);
  const { prisma } = await import('../src/lib/prisma');
  const { calendarOf, dayFromDb, dayToDb, isWorkingDay, istDay, onWorkingDay } = await import('../src/modules/project/working-days');
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true, workingDays: true, holidays: { select: { day: true } } } });
    if (!studio) throw new Error(`No studio with slug "${slug}".`);
    const cal = calendarOf({ workingDays: studio.workingDays, holidays: studio.holidays });
    const off = (d: string) => !isWorkingDay(d, cal);
    console.log(`${studio.tradeName} (${slug}) · working days ${cal.workingDays.join(',')} (1 = Monday)\n`);
    const projects = await prisma.homeProject.findMany({
      where: { cancelledAt: null, introduction: { studioId: studio.id } },
      select: {
        id: true,
        introduction: { select: { brief: { select: { contactName: true } } } },
        stages: {
          where: { actualEnd: null },
          select: { id: true, name: true, plannedStart: true, plannedEnd: true, items: { where: { doneAt: null, plannedOn: { not: null } }, select: { id: true, plannedOn: true, firstPlannedOn: true } } },
        },
      },
    });
    let stepCount = 0;
    let stageCount = 0;
    let projectCount = 0;
    for (const p of projects) {
      const steps: { id: string; to: string; first: boolean }[] = [];
      const stages: { id: string; name: string; start: string; end: string; was: string }[] = [];
      for (const s of p.stages) {
        const start = istDay(s.plannedStart);
        const end = istDay(s.plannedEnd);
        if (off(start) || off(end)) stages.push({ id: s.id, name: s.name, start: onWorkingDay(start, cal), end: onWorkingDay(end, cal), was: `${start}→${end}` });
        for (const i of s.items) {
          const day = dayFromDb(i.plannedOn!);
          if (!off(day)) continue;
          steps.push({ id: i.id, to: onWorkingDay(day, cal), first: i.firstPlannedOn !== null && dayFromDb(i.firstPlannedOn) === day });
        }
      }
      if (steps.length === 0 && stages.length === 0) continue;
      projectCount += 1;
      stepCount += steps.length;
      stageCount += stages.length;
      const client = p.introduction.brief.contactName?.trim() || p.id;
      console.log(`${client.padEnd(26)} ${steps.length} step${steps.length === 1 ? '' : 's'}${stages.length ? ` · ${stages.map((s) => `${s.name} ${s.was} → ${s.start}→${s.end}`).join(' · ')}` : ''}`);
      if (dryRun) continue;
      await prisma.$transaction(async (tx) => {
        for (const s of steps) await tx.homeChecklistItem.update({ where: { id: s.id }, data: { plannedOn: dayToDb(s.to), ...(s.first ? { firstPlannedOn: dayToDb(s.to) } : {}) } });
        for (const s of stages) await tx.homeProjectStage.update({ where: { id: s.id }, data: { plannedStart: dayToDb(s.start), plannedEnd: dayToDb(s.end) } });
      });
    }
    console.log(`\n${projectCount} project${projectCount === 1 ? '' : 's'}: ${stepCount} open step${stepCount === 1 ? '' : 's'} and ${stageCount} stage${stageCount === 1 ? '' : 's'} ${dryRun ? 'would move' : 'moved'} off days off.${dryRun ? ' Dry run: nothing was written.' : ''}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

// A module, so its helpers do not clash with the other scripts.
export {};
