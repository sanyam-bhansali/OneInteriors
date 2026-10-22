/**
 * Move a studio's leads, their history and its team over from AxLeads
 * (owner, 21 Oct 2026; docs/studio-os/AXLEADS-IMPORT.md).
 *
 *     npx tsx scripts/import-axleads.ts --file hauspire-export.json --studio <slug> --dry-run
 *     npx tsx scripts/import-axleads.ts --file hauspire-export.json --studio <slug> [--roles roles.json]
 *
 * The file is AxLeads' `scripts/export-tenant.mjs` output. The database is
 * DATABASE_URL from the environment — this script loads no .env file, so it
 * writes only where the person running it pointed it (`scripts/with-env.ps1`
 * loads .env.local for those who want that). The target host is printed
 * first, never the credentials.
 *
 * A dry run prints the full report and writes nothing. A real run prints the
 * same report, writes, prints what it wrote, and leaves one AuditLog row
 * (`studio.import.axleads`). Running it again skips everything already
 * imported. Nothing is sent to anybody: no invites, no WhatsApp, no SMS.
 * The roles file can also set names, sales roles, reporting lines and a team
 * pool (owner, 22 Oct 2026); if it asks for something that cannot be done,
 * the report says what (✗) and a real run writes nothing.
 */

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { formatReport, parseChoices, parseExport } from '../src/modules/studio-import-axleads/map';
import { runImport } from '../src/modules/studio-import-axleads/import';

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

function readJson(path: string, what: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
  } catch (error) {
    console.error(`Could not read the ${what} ${path}: ${(error as Error).message}`);
    process.exit(1);
  }
}

async function main() {
  const file = arg('file');
  const slug = arg('studio')?.trim();
  const rolesFile = arg('roles');
  const dryRun = process.argv.includes('--dry-run');
  if (!file || !slug) {
    console.error('Usage: npx tsx scripts/import-axleads.ts --file <export.json> --studio <slug> [--dry-run] [--roles roles.json]');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Point it at the database to import into.');
    process.exit(1);
  }
  const host = url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0];
  console.log(`▶ database: ${host}`);

  const parsed = parseExport(readJson(file, 'export'));
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exit(1);
  }
  const choices = parseChoices(rolesFile ? readJson(rolesFile, 'roles file') : undefined);
  if (!choices.ok) {
    console.error(choices.error);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) {
      console.error(`No studio with slug "${slug}".`);
      process.exit(1);
    }
    const stageCount = await prisma.studioStage.count({ where: { studioId: studio.id } });
    if (stageCount === 0) {
      console.error('That studio has no pipeline columns yet. Open Leads once in the studio (it makes them), then run this again.');
      process.exit(1);
    }

    const started = Date.now();
    const { plan, blocked, written } = await runImport(prisma, { studioId: studio.id, ax: parsed.data, choices: choices.choices, dryRun });
    console.log(formatReport(plan.report, { tenant: parsed.data.tenant.name, studio: `${studio.tradeName} (${slug})`, dryRun }));

    if (!written) {
      if (blocked.length && !dryRun) {
        console.error(`\nNothing was written: the roles file asks for ${blocked.length === 1 ? 'something' : `${blocked.length} things`} that cannot be done (✗ above). Fix it, dry-run, and run again.`);
        process.exitCode = 1;
        return;
      }
      console.log(`\nDry run: nothing was written.${blocked.length ? ' Fix the roles file (✗ above) first, then' : ''} Run again without --dry-run to import.`);
      return;
    }
    console.log('\nWritten:');
    console.log(`  people added (INVITED, no invite sent)  ${written.members}`);
    for (const r of written.membersRefused) console.log(`    not added: ${r.name} — ${r.reason}`);
    console.log(`  fields added                           ${written.fields}`);
    console.log(`  source names added                     ${written.leadSources}`);
    console.log(`  new cards                              ${written.created}`);
    console.log(`  merged into a card                     ${written.merged}`);
    console.log(`  given to their person (second run)     ${written.backfilled}`);
    console.log(`  history lines                          ${written.events}`);
    if (written.salesRolesMade.length) console.log(`  sales roles made                       ${written.salesRolesMade.join(', ')}`);
    console.log(`  sales roles given                      ${written.salesRolesSet}`);
    console.log(`  reporting lines set                    ${written.reportsToSet}`);
    for (const r of written.salesRefused) console.log(`    not done: ${r.name} — ${r.reason}`);
    if (written.poolMoves) console.log(`  moved into the team pool (second run)  ${written.poolMoves}`);
    console.log(`  in ${Math.round((Date.now() - started) / 1000)}s. Audit: studio.import.axleads. Check them at /studio/clients.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  if ((error as { code?: string }).code === 'P2022') {
    console.error('This database does not have the import columns yet. Apply migration 20261021110000_axleads_import first (prisma migrate deploy), then run this again.');
  } else {
    console.error(error);
  }
  process.exit(1);
});
