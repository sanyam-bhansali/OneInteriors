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

/**
 * A hard floor under every scaffolding flag.
 *
 * ## Why this exists, given the flags already had a guard
 *
 * All three dev flags were gated on `rosterIsReal()` alone, and the reasoning
 * was sound: declaring the roster real closes them everywhere at once. The
 * problem is what that leaves when the roster has NOT been declared real yet —
 * which is the state a production deployment is in from first deploy until
 * somebody remembers to set one variable.
 *
 * In that window, `DEV_OPS_NO_AUTH=1` opens every studio's GSTIN and every
 * customer's name, phone and email to anyone who guesses `/ops`, and
 * `DEV_SHOW_OTP_ON_SCREEN=1` lets anyone sign in as any phone number. Both on a
 * live site. The safety rested entirely on a deployer remembering a second,
 * unrelated variable, and `NEXT_PUBLIC_ROSTER_IS_REAL` is inlined at build
 * time — so setting it in the Vercel dashboard without redeploying looks like
 * throwing the switch and is not.
 *
 * So: production refuses all three outright, whatever any variable says. The
 * roster check stays as the second condition, because it is the one that
 * closes them on a staging deployment the day real studios land there.
 *
 * This cannot be turned off by configuration, which is the point.
 */

export function showUnverifiedStudios(): boolean {
  if (isProduction()) return false;
  if (rosterIsReal()) return false;
  return process.env.DEV_SHOW_UNVERIFIED_STUDIOS?.trim() === '1';
}

/**
 * Development only: print the sign-in code on the screen instead of requiring
 * the WhatsApp message to arrive.
 *
 * ## Be clear about what this costs
 *
 * With this on, **the OTP verifies nothing.** Anyone can type any Indian mobile
 * number, read the code off the page, and become the signed-in owner of that
 * number's account. The entire point of an OTP — proving the person holds the
 * phone — is gone. It is not a weakened check; it is no check.
 *
 * ## Why it exists anyway
 *
 * A WhatsApp authentication template needs Meta approval, which takes days, and
 * until it clears nobody can get past the sign-in gate on a deployed build —
 * which means `/quotes`, `/compare`, the expert request and the share link
 * cannot be tested at all. Blocking a week of work on a template review is
 * worse than a deliberate, loudly-labelled hole in a pre-launch site that is
 * `noindex` and whose studios are admitted placeholders.
 *
 * ## Why it cannot survive launch
 *
 * Two conditions, and the second is the one that matters:
 *
 *  1. `DEV_SHOW_OTP_ON_SCREEN=1` is set, and
 *  2. `rosterIsReal()` is FALSE.
 *
 * Declaring the roster real disables it everywhere, immediately, with no second
 * edit — the same guard the studio gate uses. The day this site has a real
 * studio on it is the day this stops working, and that is not a coincidence:
 * both flags are answering "is anything on this deployment real yet?"
 *
 * Delete this before the first real customer. It is scaffolding.
 */
export function showOtpOnScreen(): boolean {
  /* Production first, unconditionally. With this on the OTP verifies nothing —
     anyone types a number, reads the code off the page, and owns that account.
     It is not a weakened check, it is no check, and it must not be one
     forgotten variable away from being live. */
  if (isProduction()) return false;
  if (rosterIsReal()) return false;
  return process.env.DEV_SHOW_OTP_ON_SCREEN?.trim() === '1';
}

/**
 * Development only: open the ops console without signing in.
 *
 * ## What this exposes
 *
 * Everything under /ops, to anyone who guesses the URL. That includes studio
 * legal names and GSTINs, our own private assessment of each of them, the
 * customer funnel, and consultation requests — which carry a name, a phone
 * number and an email. On a deployment with real studios or real customers on
 * it, that is a data breach rather than a convenience.
 *
 * ## Why it exists
 *
 * The ops console is gated by a role read from Postgres, which means looking at
 * it requires an OPS user, a verified sending domain, and a magic link — three
 * things that are all in progress. Waiting on all three to glance at a
 * dashboard is a poor trade while every studio on the deployment is an admitted
 * placeholder.
 *
 * ## Why it cannot survive launch
 *
 * Same two conditions as the other scaffolding flags, and the second is the one
 * that matters:
 *
 *  1. `DEV_OPS_NO_AUTH=1` is set, and
 *  2. `rosterIsReal()` is FALSE.
 *
 * Declaring the roster real closes it everywhere at once, with no second edit
 * and nobody having to remember. The day there is a real studio to expose is
 * the day this stops working.
 *
 * Delete this before the first real studio. It is scaffolding.
 */
export function opsWithoutAuth(): boolean {
  /* Production first, unconditionally. This opens studio GSTINs and customer
     names, phones and emails to anyone who guesses the URL — a breach, not a
     convenience, and it was one unset variable away from being reachable. */
  if (isProduction()) return false;
  if (rosterIsReal()) return false;
  return process.env.DEV_OPS_NO_AUTH?.trim() === '1';
}

/**
 * Shared secret for POST /api/waitlist, used by the pre-launch page at
 * oneinteriors.in — a separate deployment.
 *
 * It is a bearer token rather than a database credential on purpose. A
 * Supabase service_role key handed to a marketing landing page would let that
 * page read every user, brief and quote in this project; this lets it add a
 * row to one table. When absent the route refuses every request, because a
 * missing variable must never be the thing that opens an endpoint.
 */
export function waitlistIngestToken(): string | null {
  const t = process.env.WAITLIST_INGEST_TOKEN?.trim();
  return t ? t : null;
}
