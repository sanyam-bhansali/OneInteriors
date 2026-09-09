/**
 * Load `.env.local` for scripts run directly with tsx.
 *
 * Next injects `.env.local` automatically; a bare `npx tsx prisma/whatever.ts`
 * does not, so `DATABASE_URL` is simply absent and Prisma fails at the first
 * query with a validation error that reads like a schema problem rather than a
 * missing file.
 *
 * Importing this module for its side effect is enough — ES module imports are
 * evaluated before the importing module's own statements, so the variables are
 * in place before any `new PrismaClient()` reads them.
 *
 * Deliberately dependency-free: `dotenv` is not a direct dependency of this
 * project and adding one for four lines of parsing is not worth the supply
 * chain. Values already present in the real environment always win, so this
 * cannot override anything CI or Vercel has set.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function load(file: string): number {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return 0;

  let loaded = 0;

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;

    let value = line.slice(eq + 1).trim();

    // Strip one layer of matching quotes. A password with a '#' in it must not
    // lose everything after the hash, so comments are only stripped from
    // unquoted values.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash !== -1) value = value.slice(0, hash).trim();
    }

    process.env[key] = value;
    loaded += 1;
  }

  return loaded;
}

// `.env.local` first, so it wins over `.env` the way Next orders them.
const count = load('.env.local') + load('.env');

if (!process.env.DATABASE_URL) {
  console.error(
    'No DATABASE_URL found. Run this from the project root, with a .env.local containing your Supabase connection strings.',
  );
  process.exit(1);
}

if (count > 0) {
  console.log(`Loaded ${count} variables from .env.local\n`);
}
