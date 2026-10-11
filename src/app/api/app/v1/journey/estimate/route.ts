import { appData } from '@/modules/app/app-data';
import { journeyEstimate } from '@/modules/app/journey-view';
import { gate, json, limitByIp } from '@/modules/app-api/http';
import { briefFrom } from '@/modules/app-api/journey';

/**
 * POST /api/app/v1/journey/estimate — `{ brief }` (partial while the quiz is
 * unfinished) → `{ ok, range: { lowPaise, midPaise, highPaise, studios } | null }`.
 * The live estimate on the quiz screens, from the same function the
 * website's question pages call. Null below three studios. Public, limited per IP.
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
  return json({ ok: true, range: journeyEstimate(body.brief, await appData()) });
}
