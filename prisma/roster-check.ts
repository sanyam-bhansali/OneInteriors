/**
 * Is the roster ready to put in front of a homeowner?
 *
 * ## Why this exists as a script rather than a one-liner
 *
 * The obvious version is `npx tsx -e "..."`. In PowerShell that fails, because
 * `$disconnect` inside a double-quoted string is a PowerShell variable and
 * gets expanded to nothing before node ever sees it. A file has no quoting
 * layer to get wrong.
 *
 * ## What it answers
 *
 * `CUSTOMER_LIVE=1` opens /quiz and the rest of the customer journey. That
 * journey ends in a match against the roster, so turning it on with an empty
 * or unquotable roster means a homeowner answers nine questions and reaches a
 * blank results page — a worse first impression than the page they would have
 * seen instead.
 *
 * So this counts the things a match actually needs, not just rows:
 *
 * - ACTIVE, because the matcher refuses anything else
 * - not hidden as a test studio
 * - with at least one rate-card ROW. `Studio.rateCard` is `RateCardItem[]`,
 *   not a single record, so the test is `some: {}` and not `isNot: null` —
 *   the latter does not compile, which is the useful kind of wrong. A studio
 *   with no rows cannot produce the three-second first quote.
 * - with at least one project, because a match card with no work to show is
 *   a match nobody clicks
 *
 * Read-only. It prints counts and nothing identifying.
 */

import './load-env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Below this, opening the customer journey is worse than leaving it shut. */
const ENOUGH_TO_MATCH = 3;

async function main() {
  const [total, active, visible, quotable, withWork] = await Promise.all([
    prisma.studio.count(),
    prisma.studio.count({ where: { status: 'ACTIVE' } }),
    prisma.studio.count({ where: { status: 'ACTIVE', hiddenAsTestAt: null } }),
    prisma.studio.count({
      where: { status: 'ACTIVE', hiddenAsTestAt: null, rateCard: { some: {} } },
    }),
    prisma.studio.count({
      where: { status: 'ACTIVE', hiddenAsTestAt: null, projects: { some: {} } },
    }),
  ]);

  const ready = await prisma.studio.count({
    where: {
      status: 'ACTIVE',
      hiddenAsTestAt: null,
      rateCard: { some: {} },
      projects: { some: {} },
    },
  });

  const row = (label: string, n: number) => `  ${label.padEnd(34)} ${String(n).padStart(4)}`;

  console.log('');
  console.log('  Roster');
  console.log(row('studios, all statuses', total));
  console.log(row('ACTIVE', active));
  console.log(row('ACTIVE, not hidden as test', visible));
  console.log(row('…with a rate card', quotable));
  console.log(row('…with at least one project', withWork));
  console.log('');
  console.log(row('MATCHABLE (all of the above)', ready));
  console.log('');

  if (ready >= ENOUGH_TO_MATCH) {
    console.log(`  Enough to match on. CUSTOMER_LIVE=1 will show real studios.`);
  } else if (ready > 0) {
    console.log(
      `  Only ${ready} studio${ready === 1 ? '' : 's'} can be matched and quoted.`,
    );
    console.log(
      `  A homeowner finishing the quiz would see ${ready}, not three. Consider waiting.`,
    );
  } else {
    console.log('  Nothing matchable. Turning CUSTOMER_LIVE on would end the quiz on a');
    console.log('  blank results page — leave it off until the roster is real.');
  }

  /* Named separately because it is the likeliest cause of a low number, and
     the fix is onboarding rather than recruitment. */
  if (visible > quotable) {
    console.log('');
    console.log(
      `  ${visible - quotable} active studio${visible - quotable === 1 ? ' has' : 's have'} no rate card — they cannot produce a first quote.`,
    );
  }

  console.log('');
}

main()
  .catch((error) => {
    console.error('\n  Could not read the roster:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
