/**
 * How many database connections one server instance may open (speed, owner
 * 14 Nov 2026: "the loading speed is very slow").
 *
 * The pooler address Supabase hands out ends in `connection_limit=1`. With
 * that, Prisma has a single connection per server, so every page that asks
 * for several things at once (`Promise.all`; the studio home asks for eleven)
 * and the layout and the page rendering side by side all queue for it, one
 * query after another. Supabase's transaction pooler (port 6543) is built for
 * many short client connections, so a handful per instance is safe.
 *
 * Only ever raises a limit that is set lower, never lowers one; a local
 * database (the test copy is a single-connection PGlite) is left alone.
 * `DB_POOL_SIZE` overrides the default.
 */
export const DEFAULT_POOL_SIZE = 5;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function poolSize(env: Record<string, string | undefined> = process.env): number {
  const n = Number.parseInt(env.DB_POOL_SIZE?.trim() ?? '', 10);
  return Number.isFinite(n) && n >= 1 && n <= 20 ? n : DEFAULT_POOL_SIZE;
}

/** The address with a connection limit of at least `size`, or null when it should be used as it is. */
export function withPoolSize(url: string | undefined, size: number): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (LOCAL_HOSTS.has(parsed.hostname)) return null;
  const current = Number.parseInt(parsed.searchParams.get('connection_limit') ?? '', 10);
  if (!Number.isFinite(current) || current >= size) return null;
  parsed.searchParams.set('connection_limit', String(size));
  return parsed.toString();
}
