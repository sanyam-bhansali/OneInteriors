/**
 * Refuse to run a destructive Prisma command against a remote database.
 *
 * ## Why this exists
 *
 * `.env.local` holds the **production** connection string, because that is the
 * file Next reads and the one `.gitignore` covers. Which means every Prisma
 * CLI command typed in this repo points at the live database by default, and
 * two of them are destructive:
 *
 *   `prisma migrate dev`    offers to reset the schema when it finds drift
 *   `prisma migrate reset`  drops every table, no questions after the prompt
 *
 * That happened. `npm run db:migrate` was run against production, found a
 * modified migration, and printed *"We need to reset the public schema… All
 * data will be lost."* Prisma stopped and asked, which is the only reason this
 * is a near miss rather than an incident — but "the tool asked nicely" is not
 * a control, and the next person to type it may be tired and say yes.
 *
 * ## What counts as safe
 *
 * Only a database on this machine: `localhost`, `127.0.0.1`, `::1`, or a
 * host ending `.local`. Everything else — Supabase, any pooler, any staging
 * box someone else can see — is refused.
 *
 * The check is on the HOST, not on a `NODE_ENV` or a flag. `NODE_ENV` is
 * whatever the shell happened to have, and a flag is something you can forget
 * to set; the hostname in the connection string is the thing that actually
 * decides which rows get dropped.
 *
 * ## Getting past it, deliberately
 *
 * There is no `--force`. If you genuinely need to reset a remote database,
 * export the URL for that one command and say so out loud:
 *
 *     $env:ALLOW_DESTRUCTIVE_AGAINST = "<the exact host>"
 *
 * Naming the host is the point: you cannot set it without reading which
 * database you are about to drop.
 */

import './load-env';

const DESTRUCTIVE = process.argv[2] ?? 'this command';

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLocal(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local')
  );
}

const host = hostOf(process.env.DIRECT_URL) ?? hostOf(process.env.DATABASE_URL);

if (!host) {
  console.error(
    `\n✖ Refusing to run ${DESTRUCTIVE}: no DATABASE_URL or DIRECT_URL could be read.\n`,
  );
  process.exit(1);
}

if (isLocal(host)) {
  console.log(`✓ ${DESTRUCTIVE} against local database (${host})`);
  process.exit(0);
}

if (process.env.ALLOW_DESTRUCTIVE_AGAINST?.trim() === host) {
  console.warn(
    `\n⚠ ${DESTRUCTIVE} against REMOTE database ${host}.\n` +
      `  Allowed because ALLOW_DESTRUCTIVE_AGAINST names this exact host.\n`,
  );
  process.exit(0);
}

console.error(
  `
✖ Refusing to run ${DESTRUCTIVE}.

  It is pointed at a REMOTE database:

      ${host}

  ${DESTRUCTIVE} can drop every table. Your .env.local holds the production
  connection string, so CLI commands reach production by default.

  To apply pending migrations to production, the safe command is:

      npm run db:deploy

  which only applies migration files and never drops anything.

  If you truly meant to reset ${host}, name it explicitly:

      $env:ALLOW_DESTRUCTIVE_AGAINST = "${host}"     # PowerShell
      export ALLOW_DESTRUCTIVE_AGAINST="${host}"     # bash

  Take a backup first. Supabase → Database → Backups.
`,
);
process.exit(1);
