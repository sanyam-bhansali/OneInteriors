/**
 * Link a sign-in to a studio, so the studio dashboard can actually be used.
 *
 *   npm run db:studio-login -- you@example.com kalyani-interiors
 *   npm run db:studio-login -- you@example.com kalyani-interiors --live
 *
 * ## Why this script had to exist
 *
 * Nothing else in the codebase creates a `StudioMember`. `seed.ts` creates
 * studios with no owner, and the only writer of that table is
 * `approveApplication` — so the only route to a working studio login ran
 * through an emailed magic link, which needs `RESEND_API_KEY` and a verified
 * sending domain.
 *
 * The effect was that `/studio` could not be opened at all on a fresh database,
 * however much of it had been built. The dashboard existed and nobody could
 * reach it.
 *
 * ## What it does
 *
 * Creates or promotes a user to STUDIO, and makes them the owner of an existing
 * studio. With `--live` it also flips that studio to ACTIVE so the full
 * dashboard renders rather than the onboarding checklist.
 *
 * ## Why it refuses a real roster
 *
 * Granting yourself ownership of a studio account is exactly the thing that
 * must not be possible once real businesses are on the platform — a studio's
 * own words, rates and client details sit behind that login. So this refuses
 * to run when `NEXT_PUBLIC_ROSTER_IS_REAL=1`, the same guard the three
 * scaffolding flags in `src/lib/env.ts` use.
 *
 * Development scaffolding. Delete it before the first real studio.
 */

// Must be first: it populates DATABASE_URL before PrismaClient reads it.
import './load-env';
import { PrismaClient, UserRole, StudioStatus } from '@prisma/client';

const prisma = new PrismaClient();

function usage(message?: string) {
  if (message) console.error(`\n${message}`);
  console.error('\nUsage: npm run db:studio-login -- you@example.com <studio-slug> [--live]');
  console.error('       npm run db:studio-login -- --list     to see available slugs\n');
  process.exitCode = 1;
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const wantsList = args.includes('--list');
  const [rawEmail, rawSlug] = args.filter((a) => !a.startsWith('--'));

  /**
   * The roster guard. Same condition as every other piece of scaffolding: the
   * moment the studios are real businesses, handing out ownership of one from a
   * command line stops being convenient and becomes a way into somebody else's
   * account.
   */
  if (process.env.NEXT_PUBLIC_ROSTER_IS_REAL?.trim() === '1') {
    console.error(
      '\n✗ Refusing to run: NEXT_PUBLIC_ROSTER_IS_REAL=1.\n' +
        '  These are real studios now. Ownership comes from approving an application,\n' +
        '  not from a seed script.\n',
    );
    process.exitCode = 1;
    return;
  }

  const studios = await prisma.studio.findMany({
    select: { id: true, slug: true, tradeName: true, status: true },
    orderBy: { tradeName: 'asc' },
  });

  if (studios.length === 0) {
    console.error('\n✗ No studios in the database. Run `npm run db:seed` first.\n');
    process.exitCode = 1;
    return;
  }

  if (wantsList) {
    console.log('\nStudios in this database:\n');
    for (const s of studios) {
      console.log(`  ${s.slug.padEnd(28)} ${s.status.padEnd(12)} ${s.tradeName}`);
    }
    console.log('');
    return;
  }

  const email = rawEmail?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return usage('Need an email address.');
  }

  const slug = rawSlug?.trim();
  if (!slug) {
    return usage('Need a studio slug. Run with --list to see them.');
  }

  const studio = studios.find((s) => s.slug === slug);
  if (!studio) {
    return usage(`No studio with slug "${slug}". Run with --list to see them.`);
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { studioMember: true },
  });

  /**
   * An OPS or ADMIN account keeps its role. Demoting the person who runs the
   * console because they wanted to look at a studio dashboard would lock them
   * out of the console — and `hasRole` is rank-based, so OPS already passes the
   * STUDIO gate anyway.
   */
  const keepElevated = existing?.role === 'OPS' || existing?.role === 'ADMIN';

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, role: UserRole.STUDIO },
    update: keepElevated ? {} : { role: UserRole.STUDIO },
  });

  /**
   * `StudioMember.userId` is unique — one user belongs to at most one studio —
   * so pointing an existing member at a different studio is an update rather
   * than a second row. That is also why re-running this with a different slug
   * moves the login rather than failing.
   */
  await prisma.studioMember.upsert({
    where: { userId: user.id },
    create: { studioId: studio.id, userId: user.id, isOwner: true },
    update: { studioId: studio.id, isOwner: true },
  });

  if (live && studio.status !== StudioStatus.ACTIVE) {
    await prisma.studio.update({
      where: { id: studio.id },
      data: { status: StudioStatus.ACTIVE },
    });
  }

  const finalStatus = live ? 'ACTIVE' : studio.status;

  console.log(`\n✓ ${email} now owns ${studio.tradeName} (${studio.slug})`);
  console.log(`  Role: ${keepElevated ? `${existing?.role} — kept` : 'STUDIO'}`);
  console.log(`  Studio status: ${finalStatus}`);

  if (finalStatus === 'ACTIVE') {
    console.log('\n  The full dashboard will render — status, visibility, calendar, analytics.');
  } else {
    console.log('\n  The onboarding checklist will render. Re-run with --live for the');
    console.log('  full dashboard, or finish the five steps and have ops approve it.');
  }

  console.log('\n  Sign in at /sign-in — use the EMAIL form, not the phone one.');
  console.log('  Studio accounts have an email and no phone, so the OTP form would');
  console.log('  create a separate customer account instead.');
  console.log('\n  With no RESEND_API_KEY set, the sign-in link prints to the dev');
  console.log('  server console rather than being emailed.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
