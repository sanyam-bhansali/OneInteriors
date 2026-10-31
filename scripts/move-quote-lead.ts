/**
 * Move a quotation to the lead with the client's own mobile (owner, 31 Oct
 * 2026: XL-YOGESH, "Mr Yogesh" …1323, had gone onto a lead "Yogesh" with
 * …4609 by name and place). The lead with that mobile when there is one,
 * else a new one in the studio's intake column. Refused while the quotation
 * has a live project: delete the project first (owner, Projects → Delete).
 *
 *     npx tsx scripts/move-quote-lead.ts --studio <slug> --quote XL-YOGESH --mobile 9930701323 --name "Yogesh Kasar" --dry-run
 *     npx tsx scripts/move-quote-lead.ts --studio <slug> --quote XL-YOGESH --mobile 9930701323 --name "Yogesh Kasar"
 *
 * Both leads' timelines say what moved. One AuditLog row
 * (`studio.quote.moved_lead`). Mobiles print as their last four digits.
 * The database is DATABASE_URL from the environment; the host is printed
 * first, never the credentials.
 */

import { PrismaClient } from '@prisma/client';
import { normalisePhone } from '../src/modules/studio-practice/csv';
import { phoneKey } from '../src/modules/studio-bring-in/hauspire-import-plan';

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--') ? argv[i + 1] : undefined;
}

const mask = (p: string | null | undefined) => (p ? `…${p.replace(/\D/g, '').slice(-4)}` : 'no mobile');

async function main() {
  const slug = arg('studio')?.trim();
  const number = arg('quote')?.trim();
  const phone = normalisePhone(arg('mobile') ?? '');
  const name = (arg('name') ?? '').trim().replace(/\s+/g, ' ');
  const dryRun = process.argv.includes('--dry-run');
  if (!slug || !number || !phone || phone.length !== 10 || name.length < 2) {
    throw new Error('Usage: npx tsx scripts/move-quote-lead.ts --studio <slug> --quote <number> --mobile <10 digits> --name "<client name>" [--dry-run]');
  }
  const url = process.env.DATABASE_URL ?? '';
  if (!url) throw new Error('DATABASE_URL is not set.');
  console.log(`▶ database: ${url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[/?]/)[0]}${dryRun ? '   (DRY RUN: nothing is written)' : ''}`);
  const prisma = new PrismaClient({ datasourceUrl: /[?&]pool_timeout=/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}pool_timeout=60` });
  try {
    const studio = await prisma.studio.findUnique({ where: { slug }, select: { id: true } });
    if (!studio) throw new Error(`No studio with slug "${slug}".`);
    const studioId = studio.id;
    const quote = await prisma.studioQuote.findFirst({ where: { studioId, number }, select: { id: true, number: true, clientId: true, client: { select: { name: true, phone: true } } } });
    if (!quote) throw new Error(`No quotation ${number}.`);
    const live = await prisma.homeProject.findFirst({ where: { signedQuoteId: quote.id, cancelledAt: null }, select: { id: true } });
    if (live) throw new Error(`Quotation ${number} has a project. Delete the project first (Projects → open it → Delete), then run this again.`);

    /* Mobiles are stored as typed (+91, spaces): narrowed by the last four digits, compared as ten. */
    const target =
      (await prisma.studioClient.findMany({ where: { studioId, phone: { contains: phone.slice(-4) }, isDemo: false, deletedAt: null }, select: { id: true, name: true, phone: true } })).find(
        (l) => phoneKey(l.phone) === phone,
      ) ?? null;
    console.log(`Quotation ${quote.number}: now on ${quote.client ? `${quote.client.name} ${mask(quote.client.phone)}` : 'no lead'}`);
    console.log(`  → ${target ? `the lead ${target.name} ${mask(phone)} (already on the board)` : `a new lead "${name}" ${mask(phone)}`}`);
    if (target && target.id === quote.clientId) {
      console.log('Already on that lead: nothing to do.');
      return;
    }
    if (dryRun) {
      console.log('Dry run: nothing was written. Run again without --dry-run to move it.');
      return;
    }

    await prisma.$transaction(async (tx) => {
      let leadId = target?.id ?? null;
      if (!leadId) {
        const intake = await tx.studioStage.findFirst({ where: { studioId }, orderBy: [{ isIntake: 'desc' }, { sortOrder: 'asc' }], select: { id: true } });
        if (!intake) throw new Error('The pipeline has no columns.');
        leadId = (await tx.studioClient.create({ data: { studioId, stageId: intake.id, name, phone, source: 'OTHER', sourceNote: `Made for quotation ${quote.number}` }, select: { id: true } })).id;
        await tx.studioClientEvent.create({ data: { studioId, clientId: leadId, kind: 'CREATED', actor: 'SYSTEM', byName: 'scripts/move-quote-lead.ts', summary: `Added for quotation ${quote.number}, which was on another lead` } });
      }
      await tx.studioQuote.update({ where: { id: quote.id }, data: { clientId: leadId, clientName: name, clientPhone: phone } });
      await tx.studioClientEvent.create({ data: { studioId, clientId: leadId, kind: 'QUOTED', actor: 'SYSTEM', byName: 'scripts/move-quote-lead.ts', summary: `Quotation ${quote.number} moved here from ${quote.client?.name ?? 'no lead'}`, meta: { quoteId: quote.id } } });
      if (quote.clientId) {
        await tx.studioClientEvent.create({ data: { studioId, clientId: quote.clientId, kind: 'NOTE', actor: 'SYSTEM', byName: 'scripts/move-quote-lead.ts', summary: `Quotation ${quote.number} moved to ${name} ${mask(phone)}: it was not this client's`, meta: { quoteId: quote.id } } });
      }
      await tx.auditLog.create({ data: { actorId: null, action: 'studio.quote.moved_lead', entityType: 'StudioQuote', entityId: quote.id, after: { from: quote.clientId, to: leadId, created: !target } } });
    });
    console.log('Moved.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
