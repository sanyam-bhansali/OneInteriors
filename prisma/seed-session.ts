/**
 * Mint a session token for the screenshot script.
 *
 *   npm run db:session -- you@example.com
 *
 * Prints an `oi_session` value you can hand to `SHOT_COOKIE`. It exists to
 * remove a fiddly manual step: signing in, opening DevTools, finding
 * Application → Storage → Cookies, and copying a value out of a table.
 *
 * ## Why this is safe to have in the repo
 *
 * It creates a real session for an account that ALREADY EXISTS. It cannot
 * create a user, cannot raise a role, and refuses to run against a remote
 * database — so the worst it can do is give you a session for an account on
 * your own machine that you could have signed into anyway.
 *
 * That is deliberately weaker than it could be. A script that created the
 * account too would be an account-creation bypass wearing a helper's clothes,
 * and the whole reason /studio has no DEV_NO_AUTH flag is that convenience is
 * not worth an auth bypass in the product.
 *
 * The session is short-lived on purpose: long enough to take screenshots, not
 * long enough to forget about.
 */

import './load-env';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

/** Two hours. This is for a screenshot run, not for working in. */
const MINUTES = 120;

function assertLocal() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* unparseable */ }

  const local =
    host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
    host === '[::1]' || host.endsWith('.local');

  if (local) return;

  console.error(
    `\n✖ Refusing to mint a session against a remote database (${host || 'unreadable'}).\n\n` +
    '  This prints a working session token to your terminal, where it lands in\n' +
    '  scrollback, in shell history if you paste it, and in any screen share.\n' +
    '  That is an acceptable trade for a local database full of fixtures and\n' +
    '  not for one holding a studio\'s real client list.\n',
  );
  process.exit(1);
}

async function main() {
  assertLocal();

  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('\nUsage: npm run db:session -- you@example.com\n');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    console.error(
      `\n✖ No account for ${email}.\n\n` +
      '  This mints a session for an account that already exists; it does not\n' +
      '  create one. To make a studio account:\n\n' +
      '      npm run db:studio-login -- ' + email + ' northlight-studio --live\n\n' +
      '  or an ops account:\n\n' +
      '      npm run db:ops -- ' + email + ' "Your Name"\n',
    );
    process.exitCode = 1;
    return;
  }

  /* Same shape as modules/auth/session.ts: 256 bits, url-safe, and only the
     SHA-256 is stored. Kept in step with that file deliberately — if the
     session format ever changes there, this breaks loudly rather than minting
     a token nothing accepts. */
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + MINUTES * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userAgent: 'screenshot-script',
      expiresAt,
    },
  });

  console.log(`\n✓ Session for ${user.email} (${user.role}), valid ${MINUTES} minutes.\n`);
  console.log('Run the capture with it:\n');
  console.log(`  $env:SHOT_COOKIE="${token}"; npm run shots     # PowerShell`);
  console.log(`  SHOT_COOKIE=${token} npm run shots             # bash\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
