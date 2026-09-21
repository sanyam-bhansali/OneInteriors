/**
 * Remove the invented fixture studios from a database.
 *
 * ## Why this is a script and not a `DELETE`
 *
 * The eight fixtures in `src/data/studios.ts` were seeded so the matching
 * engine, the roster and the profile pages could be built before any real
 * studio existed. They carry invalid GSTINs and invented portfolios, and the
 * seed script itself says in as many words: *"Delete them before the pilot
 * cohort goes in."*
 *
 * That moment has arrived — real applications are coming in — and a hand-written
 * `DELETE FROM studios` is exactly how a real studio gets destroyed by accident.
 * So this script knows precisely which eight rows are fake, and is incapable of
 * touching anything else:
 *
 *   - It deletes only slugs that appear in the fixture file. A studio that is
 *     not in that list is named and left alone, always.
 *   - It refuses any fixture that has a real Project attached. `Project.studio`
 *     is `onDelete: Restrict` on purpose, and a fixture with live work on it is
 *     not a fixture any more — it is something you need to look at yourself.
 *   - It is a **dry run by default**. Nothing is deleted without `--delete`.
 *
 * ## What it does not do
 *
 * It does not touch `src/data/studios.ts`. Those fixtures are still the
 * no-database fallback in `repository.ts` — a fresh clone runs `npm run dev`
 * with no setup and sees a working roster, and the test suite is built on them.
 * Removing them from the database is the whole of the ask; removing them from
 * the codebase would break both.
 *
 * Usage:
 *   npm run db:unseed            # dry run — shows exactly what would go
 *   npm run db:unseed -- --delete
 */

// Must be first: it populates DATABASE_URL before PrismaClient reads it.
// Same import, same reason, as every other script in this directory — see the
// note in seed.ts about the afternoon it cost. Leaving it out fails at the
// first query with "Environment variable not found: DATABASE_URL", which reads
// like a schema problem rather than a missing line.
import './load-env';
import { PrismaClient } from '@prisma/client';
import { STUDIOS } from '../src/data/studios';

const prisma = new PrismaClient();

const FIXTURE_SLUGS = new Set(STUDIOS.map((s) => s.slug));

async function main() {
  const live = !!process.argv.includes('--delete');

  const existing = await prisma.studio.findMany({
    select: {
      id: true,
      slug: true,
      tradeName: true,
      status: true,
      _count: { select: { projects: true } },
    },
    orderBy: { tradeName: 'asc' },
  });

  if (existing.length === 0) {
    console.log('\nNo studios in this database. Nothing to do.\n');
    return;
  }

  const fixtures = existing.filter((s) => FIXTURE_SLUGS.has(s.slug));
  const real = existing.filter((s) => !FIXTURE_SLUGS.has(s.slug));

  // Named first and every time, so it is obvious what is being preserved
  // rather than merely asserted in a comment.
  console.log(`\n${existing.length} studio(s) in this database.\n`);

  if (real.length > 0) {
    console.log(`NOT FIXTURES — these are left completely alone (${real.length}):`);
    for (const s of real) {
      console.log(`  · ${s.tradeName} (${s.slug}) — ${s.status}`);
    }
    console.log('');
  }

  if (fixtures.length === 0) {
    console.log('No fixture studios found. Nothing to remove.\n');
    return;
  }

  // A fixture carrying a real project is a contradiction, and the schema will
  // refuse the delete anyway. Better to say why here than to surface a foreign
  // key error from three layers down.
  const blocked = fixtures.filter((s) => s._count.projects > 0);
  const removable = fixtures.filter((s) => s._count.projects === 0);

  if (blocked.length > 0) {
    console.log(`SKIPPED — a real project is attached, so these are not safe to delete:`);
    for (const s of blocked) {
      console.log(`  · ${s.tradeName} (${s.slug}) — ${s._count.projects} project(s)`);
    }
    console.log('  Look at these by hand. A fixture with live work on it is not a fixture.\n');
  }

  if (removable.length === 0) {
    console.log('Nothing removable.\n');
    return;
  }

  console.log(`FIXTURES TO REMOVE (${removable.length}):`);
  for (const s of removable) console.log(`  · ${s.tradeName} (${s.slug})`);

  if (!live) {
    console.log(
      `\nDry run — nothing has been deleted.\n` +
        `Re-run with:  npm run db:unseed -- --delete\n`,
    );
    return;
  }

  const ids = removable.map((s) => s.id);

  /* Shortlist.studioId is a bare String with no foreign key, so nothing in the
     database would clean these up and they would dangle as references to rows
     that no longer exist. Every other child — verification checks, portfolio
     projects, rate card items, matches, introductions — is `onDelete: Cascade`
     and goes with the parent. */
  const shortlists = await prisma.shortlist.deleteMany({ where: { studioId: { in: ids } } });
  if (shortlists.count > 0) {
    console.log(`\nRemoved ${shortlists.count} dangling shortlist row(s).`);
  }

  const result = await prisma.studio.deleteMany({ where: { id: { in: ids } } });
  console.log(`\nDeleted ${result.count} fixture studio(s).`);

  const left = await prisma.studio.count();
  console.log(
    `${left} studio(s) remain.` +
      (left === 0
        ? ` The roster is genuinely empty now — /studios will say so, and matching\n` +
          `will return nothing until a real studio is verified. That is the honest\n` +
          `day-one state rather than a bug.\n`
        : `\n`),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
