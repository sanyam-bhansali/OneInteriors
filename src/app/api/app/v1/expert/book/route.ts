import { fail, gate, json, readJson, signedIn, str } from '@/modules/app-api/http';
import { bookExpertCall, shortlistedStudioIds } from '@/modules/consultation/book';
import { slotLabel } from '@/modules/consultation/slots';
import { appData } from '@/modules/app/app-data';
import { listedStudios, topMatches } from '@/modules/app/journey';
import { loadBrief } from '@/modules/brief/repository';
import { filedRatesFor } from '@/data/filed-rates';

/**
 * POST /api/app/v1/expert/book — `{ startsAt, slugs? }` →
 * `{ ok, booking: { startsAt, label } }`, or 409 when somebody took the slot.
 *
 * Booked through the same module as the website's expert screen. The call is
 * about the studios named, else the shortlist sent with `journey/submit`,
 * else the brief's own matches — the three the customer was shown.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await readJson(req)) as { startsAt?: unknown; slugs?: unknown } | null;
  const startsAt = str(body?.startsAt, 40);
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) return fail(400, 'Pick a time.');

  const [data, loaded] = await Promise.all([appData(), loadBrief()]);
  const slugs = Array.isArray(body?.slugs) ? body.slugs.filter((s): s is string => typeof s === 'string') : [];
  const listed = listedStudios(data);
  let studioIds = slugs.flatMap((slug) => listed.find((s) => s.slug === slug)?.id ?? []);
  if (studioIds.length === 0 && loaded.id) studioIds = await shortlistedStudioIds(loaded.id);
  if (studioIds.length === 0 && loaded.found) {
    studioIds = topMatches(loaded.brief, data.studios, data.rates, filedRatesFor, data.allowUnverified).map((m) => m.studio.id);
  }

  const r = await bookExpertCall({ startsAt, studioIds });
  if (!r.ok) return fail(r.slotGone ? 409 : r.signIn ? 409 : 400, r.error);
  const at = r.scheduledFor ?? startsAt;
  return json({ ok: true, booking: { startsAt: at, label: `${slotLabel(at).day}, ${slotLabel(at).time}` } });
}
