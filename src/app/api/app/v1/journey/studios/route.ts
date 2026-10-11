import { appData } from '@/modules/app/app-data';
import { journeyStudios } from '@/modules/app/journey-view';
import { gate, json, limitByIp } from '@/modules/app-api/http';
import { briefFrom } from '@/modules/app-api/journey';

/**
 * POST /api/app/v1/journey/studios — `{ brief }` → `{ ok, studios }`: every
 * listed studio, best match for the brief first (All studios). Scored only
 * once the brief is finished, as on the website. The filters are the app's
 * own. Public, limited per IP.
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
  return json({ ok: true, studios: journeyStudios(body.brief, await appData()) });
}
