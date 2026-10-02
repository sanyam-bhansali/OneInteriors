/**
 * Set up an expert: their team account and their weekly hours.
 *
 *   npm run db:expert -- tondareswarupa@gmail.com "Ar. Swarupa Tondare"
 *
 * Hours default to the owner's of 30 Sep 2026 — Tuesday to Sunday, 11:00 to
 * 19:00 India time, closed Mondays. Pass the three colleagues who cover for
 * her the same way; each gets the same hours, and a booking takes whoever is
 * free for the slot. Days away are set per person at /ops/experts.
 *
 * Experts need a team (OPS) account, because the hours belong to a member of
 * the team (availability.ts). Run it again to reset someone's hours to these.
 */

// Must be first: it populates DATABASE_URL before PrismaClient reads it.
import './load-env';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

/** 0 = Sunday … 6 = Saturday. Monday (1) is off. */
const DAYS = [2, 3, 4, 5, 6, 0];
const START_MIN = 11 * 60;
const END_MIN = 19 * 60;

async function main() {
  const [rawEmail, name] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error('\nUsage: npm run db:expert -- expert@example.com "Their Name"\n');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: name ?? null, role: UserRole.OPS },
    update: { ...(name ? { name } : {}) },
  });
  if (user.role !== UserRole.OPS && user.role !== UserRole.ADMIN) {
    await prisma.user.update({ where: { id: user.id }, data: { role: UserRole.OPS } });
  }

  await prisma.$transaction([
    prisma.expertHours.deleteMany({ where: { expertUserId: user.id } }),
    prisma.expertHours.createMany({
      data: DAYS.map((weekday) => ({ expertUserId: user.id, weekday, startMin: START_MIN, endMin: END_MIN })),
    }),
  ]);

  console.log(`\n✓ ${user.email} is an expert — Tue to Sun, 11:00–19:00 IST`);
  console.log('  Change hours or mark days away at /ops/experts.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
