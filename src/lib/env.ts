/**
 * Environment reads.
 *
 * Deliberately free of any heavy import — `hasDatabase()` has to be answerable
 * in a build that has no database and no generated Prisma client, so it cannot
 * live in a module that imports `@prisma/client`.
 *
 * Every read here uses a TRUTHINESS check. `??` does not catch the empty string
 * that an unset variable arrives as, and that exact mistake broke a production
 * deploy once already. See CONTRIBUTING.md §8.
 */

function present(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

/** Is a database configured? When false the app serves fixture studios. */
export function hasDatabase(): boolean {
  return present(process.env.DATABASE_URL);
}

/** Is the Prisma CLI able to migrate? Needs the direct (unpooled) connection. */
export function hasDirectDatabase(): boolean {
  return present(process.env.DIRECT_URL);
}

/**
 * Supabase project, for Storage.
 *
 * The publishable key is PUBLIC by design — it is inlined into the browser
 * bundle, and that is fine. What makes it safe is Row Level Security: the key
 * only reaches what a policy allows. With RLS off it is full read/write on
 * every table, so treat "is RLS on?" as the actual security boundary and this
 * key as a project identifier.
 *
 * Nothing consumes this yet. It arrives with OI-5c, when milestone photos and
 * verification evidence need somewhere private to live.
 */
export function supabaseConfig(): { url: string; publishableKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function hasSupabase(): boolean {
  return supabaseConfig() !== null;
}

/**
 * Is the portfolio drafting agent configured?
 *
 * Everything that uses this must degrade to "the studio writes it themselves",
 * never to a blank profile or a crash. The agent is a convenience that saves a
 * studio owner an evening of writing; it is not load-bearing, and the product
 * has to work with the key absent — which is also how it works in every test.
 */
export function hasAnthropic(): boolean {
  return present(process.env.ANTHROPIC_API_KEY);
}

export function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-5';
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Is the studio roster real businesses, or still placeholders?
 *
 * This is NOT the same question as "is there a database". The database is
 * currently seeded with the eight invented studios, so keying the pre-launch
 * disclosure off `hasDatabase()` made the notice disappear the moment Postgres
 * was wired up — while every studio on the site was still fabricated, with a
 * deliberately invalid GSTIN.
 *
 * So it is an explicit flag, and the default is the safe direction: unless
 * someone has affirmatively said the roster is real, we show the notice.
 * Forgetting to set it over-discloses. Forgetting the other way would have us
 * presenting invented businesses as verified ones.
 */
export function rosterIsReal(): boolean {
  return process.env.NEXT_PUBLIC_ROSTER_IS_REAL?.trim() === '1';
}

/**
 * Development only: show studios that have NOT been verified.
 *
 * ## Why this exists
 *
 * Every customer-facing page asks the roster for `activeOnly`, so a studio in
 * ONBOARDING is invisible. That is correct and it is the product's whole
 * premise — but it also means the funnel cannot be walked end to end until a
 * studio has been verified and has entered a rate card. During development that
 * turns every test of /match, /quotes, /compare and /expert into a blocked
 * task.
 *
 * ## Why it is safe
 *
 * It requires TWO conditions, and the second is the one that matters:
 *
 *  1. `DEV_SHOW_UNVERIFIED_STUDIOS=1` is set, and
 *  2. `rosterIsReal()` is FALSE.
 *
 * The moment the roster is declared real, this bypass stops working — whatever
 * the first flag says, on every environment, with no second edit required. So
 * the dangerous state (real, unverified studios shown to a real customer as
 * though we had checked them) is not reachable by forgetting to unset a
 * variable. It is reachable only by deliberately declaring a real roster and
 * simultaneously insisting it is fake, which is not a mistake anyone makes by
 * accident.
 *
 * The variable is deliberately NOT `NEXT_PUBLIC_`: it must never be inlined
 * into the browser bundle, because the gate belongs on the server that reads
 * the database, not in code a visitor can edit.
 *
 * Delete this before the first real customer. It is scaffolding.
 */
export function showUnverifiedStudios(): boolean {
  if (rosterIsReal()) return false;
  return process.env.DEV_SHOW_UNVERIFIED_STUDIOS?.trim() === '1';
}
