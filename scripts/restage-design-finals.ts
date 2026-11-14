/**
 * Running projects whose design was signed off on a Design Final before the
 * payment stages followed it (owner, 14 Nov 2026: "after marking the design
 * quotation as final it still doesn't change the payment stages total").
 *
 *     npx tsx --conditions=react-server scripts/restage-design-finals.ts --studio <slug> --dry-run
 *     npx tsx --conditions=react-server scripts/restage-design-finals.ts --studio <slug>
 *
 * For each project not cancelled whose Design Final was marked final (sent
 * or won; the newest one) or signed off: its stages are re-split on that
 * Design Final's total, the same rule marking it final now uses
 * (src/modules/studio-design/restage.ts): the booking advance keeps its
 * amount, the percentage stages share the rest. Payments already recorded
 * stay on their stage. A project already on that total is skipped, so running
 * it twice changes nothing.
 *
 * The database is DATABASE_URL from the environment; this script loads no
 * .env file. The host is printed first, never the credentials.
 */

import type { Prisma } from '@prisma/client';

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

async function main() {
  const slug = arg('studio')?.trim();
  const dryRun = process.argv.includes('--dry-run');
  if (!slug) {
    console.error('Usage: npx tsx --conditions=react-server scripts/restage-design-finals.ts --studio <slug> [--dry-run]');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Point it at the database to write.');
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]}${dryRun ? '   (DRY RUN: nothing is written)' : ''}`);
  const { prisma } = await import('../src/lib/prisma');
  const { readSignedStages } = await import('../src/modules/portal/payments');
  const { restageOnTotal } = await import('../src/modules/studio-design/restage');
  const { quoteTotalInStudio } = await import('../src/modules/studio-quote/quotes');
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) throw new Error(`No studio with slug "${slug}".`);
    console.log(`${studio.tradeName} (${slug})\n`);
    const projects = await prisma.homeProject.findMany({
      where: { cancelledAt: null, introduction: { studioId: studio.id }, signedQuoteId: { not: null } },
      select: { id: true, signedQuoteId: true, designFinalQuoteId: true, paymentPhases: true, introduction: { select: { brief: { select: { contactName: true } } } } },
    });
    let changed = 0;
    for (const p of projects) {
      const client = p.introduction.brief.contactName?.trim() || p.id;
      // The design final signed off on, else the newest one marked final (sent or won).
      const df =
        p.designFinalQuoteId ??
        (
          await prisma.studioQuote.findFirst({
            where: { studioId: studio.id, basedOnId: p.signedQuoteId, stage: 'DESIGN', scopeForProjectId: null, status: { in: ['ISSUED', 'ACCEPTED'] } },
            orderBy: [{ issuedOn: 'desc' }, { createdAt: 'desc' }],
            select: { id: true },
          })
        )?.id ??
        null;
      if (!df) continue;
      const total = await quoteTotalInStudio(df, studio.id);
      const stages = readSignedStages(p.paymentPhases);
      if (total === null || !stages) {
        console.log(`${client.padEnd(26)} skipped: no Design Final total or no payment stages`);
        continue;
      }
      const r = restageOnTotal(stages, Math.round(total));
      if (!r.ok) {
        console.log(`${client.padEnd(26)} skipped: ${r.error}`);
        continue;
      }
      if (!r.changed) continue;
      changed += 1;
      const before = stages.reduce((a, s) => a + s.amountPaise, 0);
      console.log(`${client.padEnd(26)} ${rupees(before)} → ${rupees(total)}: ${r.stages.map((s, i) => `${s.label.split(' (')[0]} ${rupees(stages[i]!.amountPaise)}→${rupees(s.amountPaise)}`).join(' · ')}`);
      if (dryRun) continue;
      await prisma.homeProject.update({
        where: { id: p.id },
        data: { paymentPhases: r.stages as unknown as Prisma.InputJsonValue, contractPaise: BigInt(Math.round(total)) },
      });
    }
    console.log(`\n${changed} of ${projects.length} projects with a Design Final ${dryRun ? 'would move' : 'moved'} to their Design Final's total.${dryRun ? ' Dry run: nothing was written.' : ''}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
