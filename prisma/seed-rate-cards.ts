/**
 * Give the pilot studios a rate card so the quote flow has numbers to show.
 *
 *   npx tsx prisma/seed-rate-cards.ts
 *
 * Idempotent — re-running updates rather than duplicating.
 *
 * ## Who gets what, and who is refused
 *
 * Hauspire gets Hauspire's own rates. The invented fixture studios get demo
 * rates spread around them. **Every other real studio is refused by name**,
 * because seeding a real business's rate card with another company's prices is
 * the one thing `FUTURE-SCOPE.md` §3 exists to prevent — and a seed script run
 * at 1am is exactly how that rule gets broken by accident.
 *
 * Urbanline stays unquotable until they enter their own card. That is the
 * correct behaviour, not a gap.
 */

// Must be first: it populates DATABASE_URL before PrismaClient reads it.
import './load-env';
import { PrismaClient } from '@prisma/client';
import { CATEGORY, RATE_CATEGORIES } from '../src/modules/quotation/categories';
import { fixtureRateCard, hauspireRateCard, HAUSPIRE_RATES } from '../src/modules/quotation/pilot-rates';

const prisma = new PrismaClient();

/**
 * Real studios that must never receive borrowed rates. Matched on trade name,
 * case-insensitively, and the script exits rather than guessing if it meets a
 * studio it does not recognise as either a fixture or Hauspire.
 */
const NEVER_SEED = ['urbanline'];
const HAUSPIRE = 'hauspire';

async function main() {
  const studios = await prisma.studio.findMany({
    select: { id: true, tradeName: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });

  if (studios.length === 0) {
    console.log('No studios in the database. Nothing to do.');
    return;
  }

  let fixtureIndex = 0;

  for (const studio of studios) {
    const name = studio.tradeName.toLowerCase();

    if (NEVER_SEED.some((blocked) => name.includes(blocked))) {
      console.log(`SKIPPED  ${studio.tradeName} — real studio, enters its own rates.`);
      continue;
    }

    const isHauspire = name.includes(HAUSPIRE);
    const card = isHauspire ? hauspireRateCard() : fixtureRateCard(fixtureIndex);
    if (!isHauspire) fixtureIndex += 1;

    for (const category of RATE_CATEGORIES) {
      const value = card[category];
      if (value === undefined || value <= 0) continue;

      const definition = CATEGORY[category];
      const existing = await prisma.rateCardItem.findFirst({
        where: { studioId: studio.id, category },
      });

      if (existing) {
        await prisma.rateCardItem.update({
          where: { id: existing.id },
          data: { ratePaise: BigInt(value), label: definition.label, unit: definition.unit },
        });
      } else {
        await prisma.rateCardItem.create({
          data: {
            studioId: studio.id,
            category,
            label: definition.label,
            unit: definition.unit,
            ratePaise: BigInt(value),
          },
        });
      }
    }

    console.log(
      `${isHauspire ? 'HAUSPIRE' : 'FIXTURE '} ${studio.tradeName} — ${Object.keys(card).length} rates`,
    );
  }

  console.log('\nDerived from Hauspire\'s productMaster.json:');
  for (const rate of HAUSPIRE_RATES) {
    console.log(`  ${rate.category.padEnd(16)} ${String(rate.rupees).padStart(7)}  ${rate.from.slice(0, 70)}`);
  }
  console.log(
    '\nPILOT SCAFFOLDING. Delete this script once two real studios have entered their own rates.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
