/**
 * Put the starter items in the item list (owner, 10 Nov 2026): every line on
 * a standard Pune quotation, in English, Hindi and Marathi, each with its
 * example photos.
 *
 *   npx tsx prisma/seed-items.ts
 *
 * Create only. An item already there (same address) is left exactly as our
 * team edited it, except that one with NO photos gets the starter example
 * photos (public/items, starter-photos.ts). Safe to run again. Run it once
 * after the 20261110120000_item_pages migration; replace the example photos
 * with real ones in /ops/items whenever there are some. Writes nothing else.
 */

// Must be first: it populates DATABASE_URL before PrismaClient reads it.
import './load-env';
import { PrismaClient } from '@prisma/client';
import { STARTER_ITEMS } from '../src/modules/items/starter';
import { starterPhotoPaths } from '../src/modules/items/starter-photos';

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let photographed = 0;
  for (const [i, s] of STARTER_ITEMS.entries()) {
    const photos = starterPhotoPaths(s.slug);
    const exists = await prisma.itemPage.findUnique({ where: { slug: s.slug }, select: { id: true, photos: true } });
    if (exists) {
      if (exists.photos.length === 0 && photos.length > 0) {
        await prisma.itemPage.update({ where: { id: exists.id }, data: { photos } });
        photographed++;
      }
      continue;
    }
    await prisma.itemPage.create({
      data: {
        slug: s.slug,
        name: s.name,
        room: s.room,
        summary: s.summary,
        whatItDoes: s.whatItDoes,
        materials: s.materials,
        finishes: s.finishes,
        typicalSize: s.typicalSize,
        aliases: s.aliases,
        catalogueCodes: s.catalogueCodes,
        photos,
        translations: { hi: { ...s.hi }, mr: { ...s.mr } },
        published: true,
        sortOrder: (i + 1) * 10,
      },
    });
    created++;
  }
  console.log(`\n✓ ${created} added, ${STARTER_ITEMS.length - created} already there, ${photographed} given example photos.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
