/**
 * Put Hauspire's brought-in projects on their real start dates (owner,
 * 1 Nov 2026: "I have added the project start date … update the project
 * tracker as per this and mark delay as well as stage"). The sheet is
 * "Project list for new app.csv" with its Date column; the rules are in
 * src/modules/studio-bring-in/start-dates.ts.
 *
 *     npx tsx scripts/set-hauspire-start-dates.ts --studio <slug> --sheet <projects.csv> --dry-run
 *     npx tsx scripts/set-hauspire-start-dates.ts --studio <slug> --sheet <projects.csv> [--only 3,4]
 *
 * Each sheet row finds its project: by the quotation in "Quote no" when the
 * row has one, else by the client's name (and the designer, to be sure).
 * Then the whole plan moves by the days between the start it has and the
 * sheet's: the start, every stage, every step's planned day, and the days
 * the steps done before joining are dated. The step it is at then shows as
 * late by the days it really is. Steps are not ticked or unticked: when the
 * sheet's stage is not the step the project is at, the row says so and the
 * designer ticks it in the app (a tick needs a photo and a sentence).
 *
 * A dry run prints every row — the project, the start now and from the
 * sheet, the step it is at and how late it will show — and writes nothing.
 * Each project is its own transaction; running it again moves nothing
 * already on the sheet's start. Nobody is sent anything.
 *
 * The database is DATABASE_URL from the environment; this script loads no
 * .env file. The host is printed first, never the credentials.
 */

import { readFileSync } from 'node:fs';
import { nameMatch, readSheet, stepFor, type SheetRow } from '../src/modules/studio-bring-in/sheet-rules';
import { doneBeforeJoiningAt, lateDays, shiftDays, shifted, startDayFrom } from '../src/modules/studio-bring-in/start-dates';

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

const istDay = (at: Date) => new Date(at.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const dbDay = (at: Date) => at.toISOString().slice(0, 10);

async function main() {
  const slug = arg('studio')?.trim();
  const file = arg('sheet');
  const dryRun = process.argv.includes('--dry-run');
  const only = arg('only')
    ?.split(',')
    .map((s) => Number(s.trim()))
    .filter(Number.isInteger);
  if (!slug || !file) {
    console.error('Usage: npx tsx scripts/set-hauspire-start-dates.ts --studio <slug> --sheet <projects.csv> [--only 3,4] [--dry-run]');
    process.exit(1);
  }
  const sheet = readSheet(readFileSync(file, 'utf8'));
  if (!sheet.ok) throw new Error(sheet.error);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Point it at the database to write.');
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]}`);
  if (!/[?&]pool_timeout=/.test(url)) process.env.DATABASE_URL = `${url}${url.includes('?') ? '&' : '?'}pool_timeout=60`;
  const { prisma } = await import('../src/lib/prisma');

  const today = istDay(new Date());
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) throw new Error(`No studio with slug "${slug}".`);
    const studioId = studio.id;
    const owner = await prisma.studioMember.findFirst({ where: { studioId, isOwner: true, status: 'ACTIVE' }, select: { userId: true } });
    if (!owner) throw new Error('The studio has no active owner to record this as.');
    console.log(`${studio.tradeName} (${slug}) · today ${today}${dryRun ? '   (DRY RUN: nothing is written)' : ''}`);

    const projects = await prisma.homeProject.findMany({
      where: { introduction: { studioId }, cancelledAt: null },
      select: {
        id: true,
        startOn: true,
        broughtInAt: true,
        signedQuoteId: true,
        designer: { select: { user: { select: { name: true } } } },
        introduction: { select: { brief: { select: { contactName: true, user: { select: { name: true } } } } } },
      },
    });
    const quoteIds = projects.map((p) => p.signedQuoteId).filter((x): x is string => Boolean(x));
    const quotes = await prisma.studioQuote.findMany({ where: { studioId, id: { in: quoteIds } }, select: { id: true, number: true } });
    const numberOf = new Map(quotes.map((q) => [q.id, q.number]));
    const clientOf = (p: (typeof projects)[number]) => p.introduction.brief.contactName?.trim() || p.introduction.brief.user?.name?.trim() || '';
    console.log(`${projects.length} live projects on the software; ${sheet.rows.length} rows on the sheet.\n`);

    const find = (row: SheetRow) => {
      const no = (row.quoteNo ?? '').replace(/\s*\(.*\)$/, '').trim();
      if (no) {
        const byQuote = projects.filter((p) => p.signedQuoteId && (numberOf.get(p.signedQuoteId) === no || numberOf.get(p.signedQuoteId)?.replace(/-H$/, '') === no));
        if (byQuote.length === 1) return { ok: true as const, p: byQuote[0]!, how: `quotation ${no}` };
      }
      const byName = projects.filter((p) => nameMatch(row.client, clientOf(p)));
      const withDesigner = byName.filter((p) => nameMatch(row.designer, p.designer?.user.name ?? ''));
      const pick = withDesigner.length === 1 ? withDesigner : byName;
      if (pick.length === 1) return { ok: true as const, p: pick[0]!, how: `name${withDesigner.length === 1 ? ' + designer' : ''}` };
      /* The lead may carry the first name only ("Mr Pavan" for "Pavan bonkinpillewar"): the first name and the designer, when only one project fits. */
      if (!byName.length) {
        const first = row.client.trim().split(/\s+/)[0] ?? '';
        const byFirst = projects.filter((p) => nameMatch(first, clientOf(p)) && nameMatch(row.designer, p.designer?.user.name ?? ''));
        if (byFirst.length === 1) return { ok: true as const, p: byFirst[0]!, how: 'first name + designer' };
      }
      return { ok: false as const, why: pick.length ? `${pick.length} projects could be "${row.client}" (${pick.map(clientOf).join(', ')})` : `no project for "${row.client}"${no ? ` or quotation ${no}` : ''}` };
    };

    let moved = 0;
    let same = 0;
    const skipped: string[] = [];
    const used = new Set<string>();
    for (const row of sheet.rows.filter((r) => !only?.length || only.includes(r.line))) {
      const tag = `line ${String(row.line).padStart(2)} ${row.client.padEnd(24)}`;
      const realStart = startDayFrom(row.date, today);
      if (!realStart) {
        skipped.push(`${tag} no start date in the sheet ("${row.date ?? ''}")`);
        continue;
      }
      const f = find(row);
      if (!f.ok) {
        skipped.push(`${tag} ${f.why}`);
        continue;
      }
      if (used.has(f.p.id)) {
        skipped.push(`${tag} the same project as an earlier row (${clientOf(f.p)})`);
        continue;
      }
      used.add(f.p.id);

      const stages = await prisma.homeProjectStage.findMany({
        where: { projectId: f.p.id },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, kind: true, plannedStart: true, plannedEnd: true, actualEnd: true, items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, label: true, inScope: true, plannedOn: true, doneAt: true, doneSource: true } } },
      });
      const days = shiftDays(dbDay(f.p.startOn), realStart);
      const design = stages.find((s) => s.kind === 'DESIGN');
      const current = design?.items.find((i) => i.inScope && !i.doneAt) ?? null;
      const want = stepFor(row.stage);
      const newPlanned = current?.plannedOn ? dbDay(shifted(current.plannedOn, days)) : null;
      const late = lateDays(newPlanned, today);
      const stageNote = !current ? 'design all done' : want && current.label !== want ? `at "${current.label}", the sheet says "${want}": the designer ticks it` : `at "${current.label}"`;
      console.log(
        `${tag} ${clientOf(f.p)} (${f.how}) · start ${dbDay(f.p.startOn)} → ${realStart} (${days >= 0 ? '+' : ''}${days} days) · ${stageNote}${newPlanned ? ` · planned ${newPlanned}, ${late ? `${late} days late` : 'on time'}` : ''}`,
      );
      if (days === 0) {
        same++;
        continue;
      }
      if (dryRun) continue;

      const came = f.p.broughtInAt ?? new Date();
      await prisma.$transaction(
        async (tx) => {
          await tx.homeProject.update({ where: { id: f.p.id }, data: { startOn: shifted(f.p.startOn, days) } });
          for (const s of stages) {
            let lastDone: Date | null = null;
            for (const it of s.items) {
              const plannedOn = it.plannedOn ? shifted(it.plannedOn, days) : null;
              const before = it.doneAt && it.doneSource === 'BEFORE_JOINING';
              const doneAt = before ? doneBeforeJoiningAt(plannedOn, it.doneAt!, came, days) : null;
              if (doneAt && (!lastDone || doneAt > lastDone)) lastDone = doneAt;
              await tx.homeChecklistItem.update({ where: { id: it.id }, data: { plannedOn, ...(doneAt ? { doneAt } : {}) } });
            }
            /* A stage finished before joining ends on its last step; one finished in the app keeps its day. */
            const allBefore = s.items.every((i) => !i.inScope || (i.doneAt && i.doneSource === 'BEFORE_JOINING'));
            await tx.homeProjectStage.update({
              where: { id: s.id },
              data: { plannedStart: shifted(s.plannedStart, days), plannedEnd: shifted(s.plannedEnd, days), ...(s.actualEnd && allBefore && lastDone ? { actualEnd: lastDone } : {}) },
            });
          }
          await tx.auditLog.create({
            data: { actorId: owner.userId, action: 'project.start_set', entityType: 'HomeProject', entityId: f.p.id, before: { startOn: dbDay(f.p.startOn) }, after: { startOn: realStart, shiftDays: days, source: 'hauspire sheet 1 Nov 2026' } },
          });
        },
        { maxWait: 60_000, timeout: 120_000 },
      );
      moved++;
    }

    const left = projects.filter((p) => p.broughtInAt && !used.has(p.id));
    console.log(`\n${dryRun ? 'Would move' : 'Moved'} ${dryRun ? used.size - same : moved} · already on the sheet's start ${same} · skipped ${skipped.length}`);
    for (const s of skipped) console.log(`  ✗ ${s}`);
    if (left.length && !only?.length) console.log(`Brought-in projects not on the sheet (left as they are): ${left.map(clientOf).join(', ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
