/**
 * Give a client their name everywhere it was saved wrong (owner, 31 Oct
 * 2026: Chetan Patil's AxLeads lead had his mobile, 9373798010, typed as his
 * name, and the brought-in project copied it). The lead with that mobile,
 * and for each of its projects the client's brief, the invite and the
 * customer's account name, but only where the old name is the one being
 * replaced. Quotations keep the name they were issued with, unless
 * `--quotes` (owner, 12 Nov 2026: "Change Ganesh pawar projects name, lead,
 * quotation name all to Rahul Pawar"): then the lead's quotations with the old
 * name get the new one too (the copies already sent, R1, R2…, stay as sent).
 * The lead is found by `--mobile`, or by its current name with `--from`.
 *
 *     npx tsx scripts/rename-client.ts --studio <slug> --mobile 9373798010 --name "Chetan Patil" --dry-run
 *     npx tsx scripts/rename-client.ts --studio <slug> --from "Ganesh Pawar" --name "Rahul Pawar" --quotes --dry-run
 *
 * The lead's timeline says what changed (EDITED). One AuditLog row
 * (`studio.client.renamed`). The database is DATABASE_URL from the
 * environment; the host is printed first, never the credentials.
 */

import { PrismaClient } from '@prisma/client';
import { phoneKey } from '../src/modules/studio-bring-in/hauspire-import-plan';

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--') ? argv[i + 1] : undefined;
}

async function main() {
  const slug = arg('studio')?.trim();
  const phone = arg('mobile') ? phoneKey(arg('mobile')) : '';
  const from = (arg('from') ?? '').trim().replace(/\s+/g, ' ');
  const name = (arg('name') ?? '').trim().replace(/\s+/g, ' ');
  const dryRun = process.argv.includes('--dry-run');
  const withQuotes = process.argv.includes('--quotes');
  if (!slug || (!(phone && phone.length === 10) && from.length < 2) || name.length < 2) {
    throw new Error('Usage: npx tsx scripts/rename-client.ts --studio <slug> (--mobile <10 digits> | --from "<current name>") --name "<client name>" [--quotes] [--dry-run]');
  }
  const url = process.env.DATABASE_URL ?? '';
  if (!url) throw new Error('DATABASE_URL is not set.');
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]}${dryRun ? '   (DRY RUN: nothing is written)' : ''}`);
  const prisma = new PrismaClient({ datasourceUrl: /[?&]pool_timeout=/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}pool_timeout=60` });
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true } });
    if (!studio) throw new Error(`No studio with slug "${slug}".`);
    const studioId = studio.id;
    /* Mobiles are stored as typed (+91, spaces): narrowed by the last four digits, compared as ten. */
    const leads = phone
      ? (
          await prisma.studioClient.findMany({ where: { studioId, phone: { contains: phone.slice(-4) }, isDemo: false, deletedAt: null }, select: { id: true, name: true, phone: true, bookedIntroductionId: true } })
        ).filter((l) => phoneKey(l.phone) === phone)
      : await prisma.studioClient.findMany({ where: { studioId, name: { equals: from, mode: 'insensitive' }, isDemo: false, deletedAt: null }, select: { id: true, name: true, phone: true, bookedIntroductionId: true } });
    if (leads.length !== 1) {
      for (const l of leads) console.log(`  lead "${l.name}" · mobile …${(l.phone ?? '').replace(/\D/g, '').slice(-4)}${l.bookedIntroductionId ? ' · has a project' : ''}`);
      throw new Error(`${leads.length} leads ${phone ? 'have this mobile' : `are named "${from}"`}; this script renames exactly one.${leads.length > 1 ? ' Use --mobile to pick one.' : ''}`);
    }
    const lead = leads[0]!;
    const old = lead.name;
    console.log(`Lead: "${old}" → "${name}"`);

    const intro = lead.bookedIntroductionId
      ? await prisma.introduction.findUnique({
          where: { id: lead.bookedIntroductionId },
          select: { brief: { select: { id: true, contactName: true, user: { select: { id: true, name: true } } } }, homeProject: { select: { id: true, invites: { where: { revokedAt: null }, select: { id: true, name: true } } } } },
        })
      : null;
    const brief = intro?.brief ?? null;
    const same = (v: string | null | undefined) => (v ?? '').trim() === old.trim();
    const briefChange = brief && same(brief.contactName);
    const userChange = brief?.user && same(brief.user.name);
    const invites = intro?.homeProject?.invites.filter((i) => same(i.name)) ?? [];
    /* --quotes: the lead's quotations still under the old name (the live copy; sent revisions stay as sent). */
    const quotes = withQuotes ? await prisma.studioQuote.findMany({ where: { studioId, clientId: lead.id, clientName: { equals: old.trim(), mode: 'insensitive' } }, select: { id: true, number: true } }) : [];
    if (withQuotes) console.log(`Quotations: ${quotes.length ? quotes.map((q) => q.number).join(', ') : 'none under the old name'}`);
    console.log(`Project: ${intro?.homeProject ? `client name ${briefChange ? `"${brief!.contactName}" → "${name}"` : 'already right'}; account ${userChange ? 'renamed' : 'kept'}; ${invites.length} invite(s) renamed` : 'none booked on this lead'}`);
    if (dryRun) {
      console.log('Dry run: nothing was written. Run again without --dry-run to rename.');
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.studioClient.update({ where: { id: lead.id }, data: { name } });
      if (briefChange) await tx.brief.update({ where: { id: brief!.id }, data: { contactName: name } });
      if (userChange) await tx.user.update({ where: { id: brief!.user!.id }, data: { name } });
      for (const i of invites) await tx.homeProjectInvite.update({ where: { id: i.id }, data: { name } });
      if (quotes.length) await tx.studioQuote.updateMany({ where: { id: { in: quotes.map((q) => q.id) } }, data: { clientName: name } });
      await tx.studioClientEvent.create({ data: { studioId, clientId: lead.id, kind: 'EDITED', actor: 'SYSTEM', byName: 'scripts/rename-client.ts', summary: `Name changed from "${old}" to "${name}"`, meta: { from: old, to: name } } });
      await tx.auditLog.create({ data: { actorId: null, action: 'studio.client.renamed', entityType: 'StudioClient', entityId: lead.id, after: { from: old, to: name, project: intro?.homeProject?.id ?? null, quotes: quotes.map((q) => q.number) } } });
    });
    console.log('Renamed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
