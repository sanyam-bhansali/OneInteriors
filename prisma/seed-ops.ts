/**
 * Create or promote an ops account.
 *
 *   npm run db:ops -- you@example.com "Your Name"
 *
 * There is deliberately no self-signup and no "first user becomes admin" rule.
 * Ops accounts see every studio's legal name, GSTIN and verification internals,
 * so they are granted by someone with database access, on purpose, one at a
 * time.
 *
 * Idempotent: run it again on the same address to promote an existing user.
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [rawEmail, name] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error('\nUsage: npm run db:ops -- you@example.com "Your Name"\n');
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: name ?? null, role: UserRole.OPS },
    update: { role: UserRole.OPS, ...(name ? { name } : {}) },
  });

  console.log(
    existing
      ? `\n✓ Promoted ${user.email} to OPS (was ${existing.role})`
      : `\n✓ Created ops account ${user.email}`,
  );
  console.log('  Sign in at /sign-in — no password, a link is emailed.');
  console.log(
    '  With no RESEND_API_KEY set, the link prints to the dev server console instead.\n',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
