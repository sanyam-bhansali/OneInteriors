import { appData } from '@/modules/app/app-data';
import { journeyMatches } from '@/modules/app/journey-view';
import { gate, json, limitByIp } from '@/modules/app-api/http';
import { briefFrom } from '@/modules/app-api/journey';

/**
 * POST /api/app/v1/journey/matches — `{ brief }` → the matches for each band
 * with their first quotes, the brief's own band and its style DNA
 * (`journeyMatches`: the same ranking and pricing as the website's /app).
 * Empty bands until the brief is finished (`completedAt`). `ratesReal` is
 * false while studios are priced on pre-launch archive rates; the app says
 * so, as the website does. Public, limited per IP.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const limited = await limitByIp(req, 'journey');
  if (limited) return limited;
  const body = await briefFrom(req);
  if (!body.ok) return body.response;
  const data = await appData();
  return json({ ok: true, ...journeyMatches(body.brief, data), ratesReal: data.ratesReal });
}
