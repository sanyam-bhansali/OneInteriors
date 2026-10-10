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
import { hasDatabase, rosterIsReal } from '@/lib/env';
import { filedRatesFor } from '@/data/filed-rates';
import { fromDb } from '@/lib/money';
import { readRules } from '@/modules/studio-quote/configure';
import { liveRatesFor } from './filed-rate-store';
import { ratesFromProductMaster, type MasterProduct } from './product-master-rates';
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
    .findUnique({ where: { slug }, select: { id: true, ratesFilledAt: true } })
    .catch((error: unknown) => {
      console.error('[rates] studio lookup failed, using placeholder', slug, error);
      return null;
    });
  if (!studio) return { rates: placeholder, realCodes: [] };

  /* Filed rates, then the product master over them: once ops has approved a
     studio's product master it is the one price list, for its own builder
     and for its customers alike (`product-master-rates.ts`). */
  const live = {
    ...(await liveRatesFor(studio.id)),
    ...(studio.ratesFilledAt ? await masterRatesFor(studio.id, studio.ratesFilledAt) : {}),
  };
  const realCodes = Object.keys(live);
  // A real roster is priced on its own rates only (rate-policy.ts).
  if (rosterIsReal()) return { rates: live, realCodes };
  if (realCodes.length === 0) return { rates: placeholder, realCodes: [] };

  /* Live over placeholder, item by item. Spread order is the whole policy
     here and it is worth being explicit: `live` last means a filed rate
     always beats an invented one, and an item absent from `live` keeps the
     invented one rather than vanishing. */
  return { rates: { ...placeholder, ...live }, realCodes };
}

/**
 * The customer-quote rates a studio's product master gives. Empty on any
 * failure — the caller falls back exactly as it does for filed rates.
 */
async function masterRatesFor(studioId: string, filledAt: Date): Promise<StudioRates> {
  try {
    const [products, drafts] = await Promise.all([
      prisma.studioProduct.findMany({
        where: { studioId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        take: 500,
      }),
      prisma.studioProductDraft.findMany({
        where: { studioId, state: 'APPROVED' },
        select: { name: true, fromQuotations: true },
        take: 1000,
      }),
    ]);
    const seen = new Map(drafts.map((d) => [d.name.toLowerCase(), d.fromQuotations]));
    const master: MasterProduct[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code as MasterProduct['code'],
      unit: p.unit as MasterProduct['unit'],
      details: p.details,
      ratePaise: fromDb(p.ratePaise),
      rooms: p.rooms,
      defaultWidthMm: p.defaultWidthMm,
      defaultHeightMm: p.defaultHeightMm,
      defaultQty: p.defaultQty,
      inStandardBuild: p.inStandardBuild,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      rules: readRules(p.rules),
      fromQuotations: seen.get(p.name.toLowerCase()) ?? 0,
    }));
    return ratesFromProductMaster(master, filledAt.toISOString().slice(0, 10));
  } catch (error) {
    console.error('[rates] product master read failed, using filed rates', studioId, error);
    return {};
  }
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
