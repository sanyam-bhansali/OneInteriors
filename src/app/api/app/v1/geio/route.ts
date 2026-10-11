import { gate, json, signedIn } from '@/modules/app-api/http';
import { askGeioFor } from '@/modules/app/geio-ask';

/**
 * POST /api/app/v1/geio — ask GEIO about your own home.
 *
 * Body `{ question, history?, lang?, image? }`; the same checks, limits and
 * facts as the website's GEIO (`modules/app/geio-ask.ts`). Signed-in only,
 * and rate-limited by account rather than by IP: a phone network puts
 * thousands of customers behind one address.
 *
 * 200 `{ ok: true, reply }`, or `{ ok: false, reason }` with 400 (`empty`),
 * 403 (`plan`: signed with a studio on Basic — GEIO is part of Assured; before
 * signing it stays open), 429 (`busy`) or 503 (`unavailable`: no model on
 * this deployment, the monthly budget is spent, or the call failed). The photo makes the body
 * larger than `readJson` allows, so this route reads its own.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A ~1.5 MB photo as base64, plus the turns. Matches the image cap in geio-input.ts. */
const MAX_BODY = 2_200_000;
const STATUS = { empty: 400, plan: 403, busy: 429, unavailable: 503 } as const;

async function body(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text().catch(() => '');
  if (!text || text.length > MAX_BODY) return null;
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;

  const b = (await body(req)) ?? {};
  const result = await askGeioFor(
    { question: b.question, history: b.history, image: b.image, lang: b.lang, name: me.user.name?.split(' ')[0] },
    me.user,
    `user:${me.user.id}`,
  );
  return result.ok ? json(result) : json(result, STATUS[result.reason]);
}
