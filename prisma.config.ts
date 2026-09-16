/**
 * Prisma CLI configuration.
 *
 * ## The problem this solves
 *
 * The Prisma CLI reads `.env`. Next reads `.env.local`. This project keeps its
 * connection strings in `.env.local` — correctly, because that is the file
 * `.gitignore` covers and the one holding the database password — so every CLI
 * command failed with:
 *
 *     Error: Environment variable not found: DIRECT_URL
 *
 * which reads like a schema problem and is not one. `prisma/load-env.ts`
 * already existed for exactly this reason, but only the `tsx` seed scripts
 * import it; `prisma migrate deploy` had no hook to hang it on. This file is
 * that hook.
 *
 * Note that a `prisma.config.ts` switches OFF the CLI's own automatic `.env`
 * loading entirely, so loading it here is not belt-and-braces — it is now the
 * only thing that loads it. `load-env.ts` reads `.env.local` first and then
 * `.env`, matching Next's precedence, and never overwrites a variable that is
 * already set, so CI and Vercel still win.
 *
 * It also clears the deprecation warning: `package.json#prisma` goes away in
 * Prisma 7, and `migrations.seed` below is where that setting lives now.
 */

import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Side-effect import, before anything reads process.env. ES module imports are
// evaluated ahead of the importing module's own statements, so the connection
// strings are in place by the time `defineConfig` runs.
import './prisma/load-env';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    /**
     * Stated explicitly, and it has to be.
     *
     * Without a `prisma.config.ts` the CLI infers the migrations directory
     * from the schema's own location — `prisma/schema.prisma` implies
     * `prisma/migrations`. Adding this file switches that inference off along
     * with the `.env` loading, and the fallback is `./migrations` at the repo
     * root, which does not exist here.
     *
     * The failure mode is the reason this comment is long: `migrate deploy`
     * pointed at an empty or missing directory does not error. It finds
     * nothing to apply and says so in a sentence that reads like success, so
     * the first sign that a migration never ran is Postgres telling the
     * running app that a table does not exist. That cost an evening once.
     */
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
