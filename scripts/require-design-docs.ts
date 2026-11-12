/**
 * Every design step that produces a document needs it to tick (owner,
 * 12 Nov 2026: "all the steps where document is necessary like quotation 2d
 * layout etc", for new and running projects). The steps are
 * `DOCUMENT_STEPS` in src/modules/studio-design/template.ts.
 *
 *     npx tsx --conditions=react-server scripts/require-design-docs.ts --studio <slug> --dry-run
 *     npx tsx --conditions=react-server scripts/require-design-docs.ts --studio <slug>
 *
 * For the studio: its saved design steps (Settings, Design steps) get "needs
 * its file" on those steps, and every running project's design step of those
 * names that is not ticked yet gets it too. Ticked steps and cancelled
 * projects are left alone; nothing is ticked or unticked; nobody is told.
 * Running it twice changes nothing the second time.
 *
 * The database is DATABASE_URL from the environment; this script loads no
 * .env file. The host is printed first, never the credentials.
 */

import { DOCUMENT_STEPS } from '../src/modules/studio-design/template';

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const isDocStep = (label: unknown) => typeof label === 'string' && DOCUMENT_STEPS.some((d) => same(d, label));

async function main() {
  const slug = arg('studio')?.trim();
  const dryRun = process.argv.includes('--dry-run');
  if (!slug) {
    console.error('Usage: npx tsx --conditions=react-server scripts/require-design-docs.ts --studio <slug> [--dry-run]');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Point it at the database to write.');
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]}${dryRun ? '   (DRY RUN: nothing is written)' : ''}`);
  const { prisma } = await import('../src/lib/prisma');
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true, designTemplate: true } });
    if (!studio) throw new Error(`No studio with slug "${slug}".`);
    console.log(`${studio.tradeName} (${slug}) · document steps: ${DOCUMENT_STEPS.join(', ')}\n`);

    // 1. The studio's saved design steps (the template new projects copy).
    const saved = studio.designTemplate;
    const steps = Array.isArray(saved) ? saved : saved && typeof saved === 'object' && Array.isArray((saved as { steps?: unknown }).steps) ? (saved as { steps: unknown[] }).steps : null;
    if (!steps) {
      console.log('Saved design steps: none saved, so new projects use the standard steps (already updated in the code).');
    } else {
      const turnOn = steps.filter((st) => st && typeof st === 'object' && isDocStep((st as { label?: unknown }).label) && (st as { needsDocument?: unknown }).needsDocument !== true);
      console.log(`Saved design steps: ${turnOn.length} to mark "needs its file"${turnOn.length ? `: ${turnOn.map((st) => (st as { label: string }).label).join(', ')}` : ''}.`);
      if (turnOn.length && !dryRun) {
        const next = steps.map((st) => (st && typeof st === 'object' && isDocStep((st as { label?: unknown }).label) ? { ...(st as object), needsDocument: true } : st));
        const value = Array.isArray(saved) ? next : { ...(saved as object), steps: next };
        await prisma.studio.update({ where: { id: studio.id }, data: { designTemplate: value as object } });
      }
    }

    // 2. Running projects: design steps of those names, not ticked yet.
    const items = await prisma.homeChecklistItem.findMany({
      where: { doneAt: null, needsDocument: false, stage: { kind: 'DESIGN', project: { cancelledAt: null, introduction: { studioId: studio.id } } } },
      select: { id: true, label: true, stage: { select: { project: { select: { id: true, introduction: { select: { brief: { select: { contactName: true } } } } } } } } },
    });
    const hits = items.filter((i) => isDocStep(i.label));
    const byProject = new Map<string, { client: string; steps: string[] }>();
    for (const i of hits) {
      const p = i.stage.project;
      const row = byProject.get(p.id) ?? { client: p.introduction.brief.contactName?.trim() || p.id, steps: [] };
      row.steps.push(i.label);
      byProject.set(p.id, row);
    }
    for (const r of byProject.values()) console.log(`  ${r.client.padEnd(28)} ${r.steps.join(', ')}`);
    console.log(`\nRunning projects: ${hits.length} open step${hits.length === 1 ? '' : 's'} on ${byProject.size} project${byProject.size === 1 ? '' : 's'} to mark "needs its file".`);
    if (hits.length && !dryRun) {
      const { count } = await prisma.homeChecklistItem.updateMany({ where: { id: { in: hits.map((h) => h.id) }, doneAt: null }, data: { needsDocument: true } });
      console.log(`Marked ${count}.`);
    }
    if (dryRun) console.log('\nDry run: nothing was written. Run again without --dry-run to apply.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
