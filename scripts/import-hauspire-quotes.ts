/**
 * Bring every quotation from the Hauspire quotation app into One Interiors
 * (owner, 22 Oct 2026: "import everything"; docs/studio-os/QUOTE-PARITY.md).
 *
 *     npx tsx scripts/import-hauspire-quotes.ts --studio <slug> --dry-run
 *     npx tsx scripts/import-hauspire-quotes.ts --studio <slug> [--pool-team <member email or phone>]
 *     npx tsx scripts/import-hauspire-quotes.ts --studio <slug> --from-file rows.json --dry-run
 *
 * Reads the old app through the same read-only connection as "bring in a
 * running project" (HAUSPIRE_QUOTES_SUPABASE_URL / _KEY / _STUDIO_SLUG, GET
 * only — nothing is ever written there), page by page. `--from-file` reads a
 * JSON array of `quotes` rows instead (an export, or fake rows to try it).
 * The database is DATABASE_URL from the environment; this script loads no
 * .env file (`scripts/with-env.ps1` does, for those who want it). The target
 * host is printed first, never the credentials.
 *
 * A dry run prints the full report and writes nothing. A real run prints the
 * same report, writes, prints what it wrote, and leaves one AuditLog row
 * (`studio.import.hauspireQuotes`). Running it again adds only what is new,
 * updates what changed there and was not edited here, and says so. Nothing
 * is sent to anybody.
 */

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { connectionFromEnv, listAllHauspire } from '../src/modules/studio-bring-in/hauspire-fetch';
import { formatReport } from '../src/modules/studio-bring-in/hauspire-import-plan';
import { resolvePoolTeam, runHauspireImport, type PoolTeam } from '../src/modules/studio-bring-in/hauspire-import';
import type { SourceQuote } from '../src/modules/studio-bring-in/hauspire-map';

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

async function readRows(slug: string, file: string | undefined): Promise<SourceQuote[]> {
  if (file) {
    const body: unknown = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
    if (!Array.isArray(body)) throw new Error(`${file} is not a JSON array of quotes rows.`);
    return body as SourceQuote[];
  }
  const c = connectionFromEnv();
  if (!c) throw new Error('The quotation app is not connected: set HAUSPIRE_QUOTES_SUPABASE_URL, HAUSPIRE_QUOTES_SUPABASE_KEY and HAUSPIRE_QUOTES_STUDIO_SLUG (or use --from-file).');
  if (c.slug !== slug) throw new Error(`HAUSPIRE_QUOTES_STUDIO_SLUG is "${c.slug}", not "${slug}": the connection is for another studio.`);
  console.log(`▶ quotation app: ${new URL(c.url).host} (read only)`);
  const r = await listAllHauspire(c, fetch, (n) => process.stdout.write(`\r  read ${n} rows…`));
  process.stdout.write('\n');
  if (!r.ok) throw new Error(r.error);
  return r.rows;
}

async function main() {
  const slug = arg('studio')?.trim();
  const pool = arg('pool-team');
  const file = arg('from-file');
  const dryRun = process.argv.includes('--dry-run');
  if (!slug) {
    console.error('Usage: npx tsx scripts/import-hauspire-quotes.ts --studio <slug> [--dry-run] [--pool-team <member email or phone>] [--from-file rows.json]');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Point it at the database to import into.');
    process.exit(1);
  }
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]}`);

  const prisma = new PrismaClient();
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true } });
    if (!studio) {
      console.error(`No studio with slug "${slug}".`);
      process.exit(1);
    }
    let poolTeam: PoolTeam | null = null;
    if (pool) {
      const t = await resolvePoolTeam(prisma, studio.id, pool);
      if (!t.ok) {
        console.error(t.error);
        process.exit(1);
      }
      poolTeam = t.team;
    }
    const rows = await readRows(slug, file);
    const started = Date.now();
    const { plan, written } = await runHauspireImport(prisma, { studioId: studio.id, rows, dryRun, poolTeam });
    console.log(formatReport(plan.report, { studio: `${studio.tradeName} (${slug})`, dryRun, poolTeam: poolTeam?.name ?? null }));
    if (!written) {
      console.log('\nDry run: nothing was written. Run again without --dry-run to import.');
      return;
    }
    console.log('\nWritten:');
    console.log(`  leads created                 ${written.clientsCreated}`);
    console.log(`  quotations created            ${written.quotesCreated}`);
    console.log(`  quotations updated            ${written.quotesUpdated}`);
    console.log(`  revisions kept                ${written.revisions}`);
    console.log(`  failed                        ${written.failed.length}`);
    for (const f of written.failed) console.log(`    ✗ ${f.number}: ${f.reason}`);
    console.log(`  in ${Math.round((Date.now() - started) / 1000)}s. Audit: studio.import.hauspireQuotes. Check them at /studio/quotations.`);
    if (written.failed.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
