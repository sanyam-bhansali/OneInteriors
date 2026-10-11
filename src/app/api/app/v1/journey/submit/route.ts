import { appData } from '@/modules/app/app-data';
import { submitJourney } from '@/modules/app/record-journey';
import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';

/**
 * POST /api/app/v1/journey/submit — `{ slugs }` → `{ ok, shortlisted }`.
 * After verifying: keep the matches and first quotes their stored brief
 * produced, and the studios they chose (at most five, listed only) as their
 * shortlist, so ops and the expert read the same quotes they did. 409 when
 * the brief is not saved or not finished (`PUT /brief` first).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await readJson(req)) as { slugs?: unknown } | null;
  if (!Array.isArray(body?.slugs)) return fail(400, 'Name the studios you chose.');
  const slugs = body.slugs.filter((s): s is string => typeof s === 'string').slice(0, 5);
  const result = await submitJourney(slugs, await appData());
  return result.ok ? json(result) : fail(result.status, result.error);
}
