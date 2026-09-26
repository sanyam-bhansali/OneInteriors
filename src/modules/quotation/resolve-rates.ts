import 'server-only';

/**
 * The rates a studio is actually quoted on, per studio slug.
 *
 * ## Why a resolver rather than one source
 *
 * `src/data/filed-rates.ts` says in its own header that its per-studio
 * variation is a placeholder: the real figures are the archive medians, and
 * the spread across the roster is a deterministic factor invented so the
 * product could be built end to end before any studio had filed anything.
 *
 * Studios now file. But they file one at a time, so for a long while the
 * roster is a mixture — some quoted on their own documents and the rest on
 * the placeholder. This is the seam that lets both exist without the
 * comparison screen knowing which is which.
 *
 * ## Live rates win per ITEM, not per studio
 *
 * A studio whose archive yielded a kitchen and a wardrobe but no mandir keeps
 * the placeholder mandir rather than dropping off the comparison. That is
 * deliberate and it is the less obvious choice: the alternative is a studio
 * who files an archive and gets FEWER lines priced than before they bothered,
 * which would teach exactly the wrong lesson.
 *
 * It does mean a single quote can mix a real rate with a placeholder one, and
 * that is not something to be quiet about — `realCodes` reports which lines
 * are genuinely theirs, so a screen can say so.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { filedRatesFor } from '@/data/filed-rates';
import { liveRatesFor } from './filed-rate-store';
import type { StudioRates } from './catalogue';

export interface ResolvedRates {
  rates: StudioRates;
  /** Catalogue codes priced from the studio's own filed documents. */
  realCodes: string[];
}

/**
 * ## Every path out of here returns rates
 *
 * This function used to reach for Prisma with no guard and no catch, so a
 * database that was absent — or merely having a bad minute — took `/match`
 * down with a 500 rather than falling back to the placeholder table. That is
 * exactly backwards for a resolver whose entire job is to let a filed rate and
 * an invented one coexist: the fallback IS the feature, and it was the one
 * case that did not work.
 *
 * It was found by walking the customer flow with no database, where the
 * documented behaviour is fixture studios. Nine quiz steps passed and the page
 * they lead to was the one that broke.
 *
 * In production the same hole is worse: a dropped connection would blank the
 * comparison screen for every customer mid-journey, when showing placeholder
 * rates — already labelled as such — would have carried them through.
 */
export async function resolveRatesFor(slug: string): Promise<ResolvedRates> {
  const placeholder = filedRatesFor(slug);

  /* No database configured at all: fixtures. Documented in DATABASE.md as a
     first-class way to run this app, so it cannot be an error path. */
  if (!hasDatabase()) return { rates: placeholder, realCodes: [] };

  const studio = await prisma.studio
    .findUnique({ where: { slug }, select: { id: true } })
    .catch((error: unknown) => {
      console.error('[rates] studio lookup failed, using placeholder', slug, error);
      return null;
    });
  if (!studio) return { rates: placeholder, realCodes: [] };

  const live = await liveRatesFor(studio.id);
  const realCodes = Object.keys(live);
  if (realCodes.length === 0) return { rates: placeholder, realCodes: [] };

  /* Live over placeholder, item by item. Spread order is the whole policy
     here and it is worth being explicit: `live` last means a filed rate
     always beats an invented one, and an item absent from `live` keeps the
     invented one rather than vanishing. */
  return { rates: { ...placeholder, ...live }, realCodes };
}

/** Several studios at once, for the comparison screen. */
export async function resolveRatesForMany(
  slugs: string[],
): Promise<Record<string, ResolvedRates>> {
  const out: Record<string, ResolvedRates> = {};
  await Promise.all(
    slugs.map(async (slug) => {
      out[slug] = await resolveRatesFor(slug);
    }),
  );
  return out;
}
