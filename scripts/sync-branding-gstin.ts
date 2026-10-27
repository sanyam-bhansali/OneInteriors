/**
 * Copy a studio's GSTIN onto its quotation letterhead (owner, 27 Oct 2026:
 * Hauspire Luxury Design Studio holds its GSTIN, but Settings → Your details
 * and its quotations said "Not given", because the letterhead
 * (studio_branding) is a copy of the registration made before the GSTIN was
 * moved to it). Ops' GSTIN form and scripts/move-gstin.ts now keep the copy
 * in step; this mends a studio that slipped through before that.
 *
 *     npx tsx scripts/sync-branding-gstin.ts --studio <slug> --dry-run
 *     npx tsx scripts/sync-branding-gstin.ts --studio <slug>
 *
 * Touches only the letterhead's GSTIN. Refuses a REMOVED studio or one with no
 * GSTIN. Audited (`studio.branding.gstin_synced`).
 *
 * The database is DATABASE_URL from the environment; the host is printed
 * first, never the credentials.
 */
import { PrismaClient } from '@prisma/client';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}
const mask = (g: string | null) => (g ? `…${g.slice(-4)}` : 'none');

async function main() {
  const slug = arg('--studio');
  const dryRun = process.argv.includes('--dry-run');
  if (!slug) throw new Error('Usage: npx tsx scripts/sync-branding-gstin.ts --studio <slug> [--dry-run]');
  console.log(`▶ database: ${(process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[/?].*$/, '') || '(none)'}`);
  const db = new PrismaClient();
  try {
    const studio = await db.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true, status: true, gstin: true } });
    if (!studio) throw new Error(`No studio with slug ${slug}.`);
    if (studio.status === 'REMOVED') throw new Error(`${studio.tradeName} is REMOVED.`);
    if (!studio.gstin) throw new Error(`${studio.tradeName} has no GSTIN to copy.`);
    const branding = await db.studioBranding.findUnique({ where: { studioId: studio.id }, select: { gstin: true } });
    console.log(`${studio.tradeName} (${slug}): studio GSTIN ${mask(studio.gstin)} · letterhead ${branding ? mask(branding.gstin) : '(no letterhead yet)'}${dryRun ? '  (DRY RUN: nothing is written)' : ''}`);
    if (!branding) return console.log('Nothing to do: the letterhead is made from the studio, GSTIN included, at its first quotation.');
    if (branding.gstin === studio.gstin) return console.log('Nothing to do: the letterhead already shows it.');
    if (dryRun) return;
    await db.$transaction([
      db.studioBranding.update({ where: { studioId: studio.id }, data: { gstin: studio.gstin } }),
      db.auditLog.create({
        data: { actorId: null, action: 'studio.branding.gstin_synced', entityType: 'Studio', entityId: studio.id, before: { gstin: branding.gstin }, after: { gstin: studio.gstin, by: 'scripts/sync-branding-gstin.ts' } },
      }),
    ]);
    console.log(`Written. The letterhead shows ${mask(studio.gstin)}: Settings → Your details and every quotation PDF.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
