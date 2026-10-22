/**
 * Give a studio the Hauspire quotation app's document (owner, 22 Oct 2026:
 * "the export as PDF should make the PDF however it made in the previous
 * one"; docs/studio-os/QUOTE-PARITY.md).
 *
 *     npx tsx scripts/setup-hauspire-document.ts --studio <slug> --dry-run
 *     npx tsx scripts/setup-hauspire-document.ts --studio <slug>
 *
 * Sets, on the studio's branding: the old app's maroon (#531220, which
 * QuotationDocument recognises and prints with the old app's exact colours),
 * its material specification (src/lib/boilerplate.ts MATERIAL_SPEC in the
 * old app, brand in its own column), its welcome note, and the Terms &
 * Conditions Hauspire last saved in the old app's settings (5 Sep 2026;
 * scripts/fixtures/hauspire-terms-live.md). Nothing else changes; the brand
 * pages (the old app's cover.png and about.png) are uploaded in Settings →
 * Branding, where they are stored like any studio's.
 *
 * The database is DATABASE_URL from the environment; the host is printed
 * first, never the credentials. One AuditLog row (`studio.branding.hauspire`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const ACCENT = '#531220';

/** The old app's MATERIAL_SPEC, row for row. */
const MATERIAL_SPEC = [
  { item: 'Plywood', brand: 'CENTURY', spec: 'BWP (Boiling Water Proof) Grade' },
  { item: 'HDHMR', brand: 'GREEN PLY', spec: 'BWP (Boiling Water Proof) Grade' },
  { item: 'Laminates', brand: 'MERINO', spec: 'Wood, Gloss, Matt, Texture' },
  { item: 'Special Laminates', brand: 'ADVANCE, VOUGE, MERINO', spec: 'High Gloss, Special Texture' },
  { item: 'Hardware', brand: 'HETTICH', spec: 'Soft Close' },
  { item: 'False Ceiling', brand: 'SAINT GOBAIN', spec: 'Gypsum board and Gyproc Channels' },
  { item: 'Handles', brand: 'LETTO, NIMKRO', spec: 'Premium Aluminium Handles' },
  { item: 'Wiring', brand: 'POLYCAB', spec: 'Standard Thickness' },
  { item: 'Paint', brand: 'Asian Paints', spec: 'Putty, Primer and Paint' },
  { item: 'Adhesive', brand: 'FEVICOL', spec: 'Falco Fix Pro' },
];

/** The old app's WELCOME. */
const WELCOME = `At Hauspire, we understand that your home is more than just a space; it's a reflection of your dreams and aspirations. With our wide presence and a wealth of expertise, we are committed to making your vision a reality.

For laminate finishes, our state-of-the-art manufacturing ensures precision and durability — from hot-glue pressing to cutting and edge banding, every step is executed at our factory for flawless, elegant results. For more intricate designs and on-site customisations, our skilled carpenters, craftsmen and certified painters bring premium quality to every project.

Our experienced designers and architects will work closely with you to turn your house into the home you've always imagined. Thank you for choosing Hauspire.`;

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const slug = arg('--studio');
  const dryRun = process.argv.includes('--dry-run');
  if (!slug) throw new Error('Usage: npx tsx scripts/setup-hauspire-document.ts --studio <slug> [--dry-run]');
  const url = process.env.DATABASE_URL ?? '';
  console.log(`▶ database: ${url.replace(/^.*@/, '').replace(/[/?].*$/, '') || '(none)'}`);
  const terms = readFileSync(join(__dirname, 'fixtures', 'hauspire-terms-live.md'), 'utf8').trim();
  const db = new PrismaClient();
  try {
    const studio = await db.studio.findUnique({ where: { slug }, select: { id: true, tradeName: true, legalName: true } });
    if (!studio) throw new Error(`No studio with slug ${slug}.`);
    const before = await db.studioBranding.findUnique({ where: { studioId: studio.id }, select: { accentHex: true, terms: true, welcomeNote: true, materialSpec: true } });
    console.log(`${studio.tradeName} (${slug})${dryRun ? '  (DRY RUN: nothing is written)' : ''}`);
    console.log(`  colour          ${before?.accentHex ?? '(no branding yet)'} → ${ACCENT}`);
    console.log(`  material spec   ${Array.isArray(before?.materialSpec) ? before.materialSpec.length : 0} rows → ${MATERIAL_SPEC.length} rows`);
    console.log(`  terms           ${before?.terms ? `${before.terms.length} characters` : 'none'} → ${terms.length} characters (Hauspire's, saved 5 Sep 2026)`);
    console.log(`  welcome note    ${before?.welcomeNote ? 'set' : 'none'} → the old app's`);
    if (dryRun) return;
    const data = { accentHex: ACCENT, materialSpec: MATERIAL_SPEC, terms, welcomeNote: WELCOME };
    await db.$transaction(async (tx) => {
      await tx.studioBranding.upsert({
        where: { studioId: studio.id },
        update: data,
        create: { studioId: studio.id, legalName: studio.legalName?.trim() || studio.tradeName, ...data },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: 'studio.branding.hauspire',
          entityType: 'Studio',
          entityId: studio.id,
          before: before ? { accentHex: before.accentHex, hadTerms: Boolean(before.terms), specRows: Array.isArray(before.materialSpec) ? before.materialSpec.length : 0 } : undefined,
          after: { accentHex: ACCENT, specRows: MATERIAL_SPEC.length, termsChars: terms.length, by: 'scripts/setup-hauspire-document.ts' },
        },
      });
    });
    console.log('Written. Upload the old cover.png and about.png in Settings → Branding (brand pages).');
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
