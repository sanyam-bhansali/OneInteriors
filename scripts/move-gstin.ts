/**
 * Move a GSTIN from a REMOVED studio to the studio that is really that
 * company (owner, 23 Oct 2026: Hauspire's GSTIN was still on "Hauspire
 * Private Limited", an earlier duplicate of the same company that ops had
 * removed, so ops could not enter it on Hauspire Luxury Design Studio).
 *
 *     npx tsx scripts/move-gstin.ts --from <removed slug> --to <slug> --dry-run
 *     npx tsx scripts/move-gstin.ts --from <removed slug> --to <slug>
 *
 * Ops' GSTIN form keeps refusing a number another studio holds, removed or
 * not, on purpose: a studio we threw off must not come back under a new name
 * with the same registration. This script is the deliberate exception for a
 * duplicate of the same company, one pair at a time. Refuses unless `--from`
 * is REMOVED and holds a GSTIN, and `--to` is not REMOVED. In one
 * transaction the GSTIN leaves `--from` and is set on `--to` (with its PAN's
 * last four, clearing any "no registration" declaration, as `setGstin`
 * does), and the quotation letterhead's copy (studio_branding) follows on
 * both (27 Oct 2026: without it Settings and quotations kept saying "Not
 * given"). Still a claim: no verification check is recorded. Audited
 * (`studio.gstin.moved`) on both studios.
 *
 * The database is DATABASE_URL from the environment; the host is printed
 * first, never the credentials.
 */
import { PrismaClient } from '@prisma/client';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const fromSlug = arg('--from');
  const toSlug = arg('--to');
  const dryRun = process.argv.includes('--dry-run');
  if (!fromSlug || !toSlug || fromSlug === toSlug) throw new Error('Usage: npx tsx scripts/move-gstin.ts --from <removed slug> --to <slug> [--dry-run]');
  console.log(`▶ database: ${(process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[/?].*$/, '') || '(none)'}`);
  const db = new PrismaClient();
  try {
    const select = { id: true, slug: true, tradeName: true, legalName: true, status: true, gstin: true, gstinNotApplicable: true } as const;
    const from = await db.studio.findUnique({ where: { slug: fromSlug }, select });
    const to = await db.studio.findUnique({ where: { slug: toSlug }, select });
    if (!from) throw new Error(`No studio with slug ${fromSlug}.`);
    if (!to) throw new Error(`No studio with slug ${toSlug}.`);
    if (from.status !== 'REMOVED') throw new Error(`${from.tradeName} is ${from.status}, not REMOVED; this script only takes a GSTIN off a removed studio.`);
    if (to.status === 'REMOVED') throw new Error(`${to.tradeName} is REMOVED; not giving it a GSTIN.`);
    if (!from.gstin) throw new Error(`${from.tradeName} has no GSTIN to move.`);
    if (to.gstin === from.gstin) throw new Error('Both already show this GSTIN; nothing to do.');
    const gstin = from.gstin;

    console.log(`  from   ${from.tradeName} · ${from.legalName ?? '—'} (${from.slug}) · REMOVED · ${gstin}${dryRun ? '  (DRY RUN: nothing is written)' : ''}`);
    console.log(`  to     ${to.tradeName} · ${to.legalName ?? '—'} (${to.slug}) · ${to.status} · GSTIN now ${to.gstin ?? 'none'}${to.gstinNotApplicable ? ' (said no registration)' : ''}`);
    if (dryRun) return;

    await db.$transaction(async (tx) => {
      await tx.studio.update({ where: { id: from.id }, data: { gstin: null } });
      await tx.studioBranding.updateMany({ where: { studioId: from.id }, data: { gstin: null } });
      await tx.studio.update({
        where: { id: to.id },
        data: { gstin, panLast4: gstin.slice(2, 12).slice(-4), gstinNotApplicable: false, gstinNote: null },
      });
      await tx.studioBranding.updateMany({ where: { studioId: to.id }, data: { gstin } });
      const after = { gstin, from: from.id, to: to.id, by: 'scripts/move-gstin.ts' };
      await tx.auditLog.createMany({
        data: [
          { actorId: null, action: 'studio.gstin.moved', entityType: 'Studio', entityId: from.id, before: { gstin }, after },
          { actorId: null, action: 'studio.gstin.moved', entityType: 'Studio', entityId: to.id, before: { gstin: to.gstin, gstinNotApplicable: to.gstinNotApplicable }, after },
        ],
      });
    }, { timeout: 60_000, maxWait: 20_000 });
    console.log(`Written. ${gstin} is on ${to.tradeName} now (a claim until the GST portal check is recorded).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
