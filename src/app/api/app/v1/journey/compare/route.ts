import { appData } from '@/modules/app/app-data';
import { journeyCompare } from '@/modules/app/journey-view';
import { fail, gate, json, limitByIp } from '@/modules/app-api/http';
import { briefFrom } from '@/modules/app-api/journey';

/**
 * POST /api/app/v1/journey/compare — `{ brief, slugs }` → the plain words and
 * the side-by-side columns, the cells the website's compare screen shows.
 * No slugs: the brief's own matches. At most five; unlisted ones are
 * dropped, never priced. Public, limited per IP.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_COMPARED = 5;

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const limited = await limitByIp(req, 'journey');
  if (limited) return limited;
  const parsed = await briefFrom(req);
  if (!parsed.ok) return parsed.response;
  const { slugs } = parsed.body;
  if (slugs !== undefined && !Array.isArray(slugs)) return fail(400, 'Name the studios to compare.');
  const named = ((slugs as unknown[] | undefined) ?? []).filter((s): s is string => typeof s === 'string').slice(0, MAX_COMPARED);
  const data = await appData();
  return json({ ok: true, ...journeyCompare(parsed.brief, named, data), ratesReal: data.ratesReal });
}
