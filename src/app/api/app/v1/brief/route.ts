import { loadBrief, saveBrief } from '@/modules/brief/repository';
import { briefFromJson } from '@/modules/brief/from-json';
import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';

/**
 * GET  /api/app/v1/brief — the customer's stored brief, or null.
 * PUT  /api/app/v1/brief — replace it.
 *
 * Signed-in only. The app keeps the brief on the phone until sign-in, so
 * there is no anonymous server copy to claim (docs/MOBILE-APP-PLAN.md).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { brief, found } = await loadBrief();
  return json({ ok: true, brief: found ? brief : null });
}

export async function PUT(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;

  const brief = briefFromJson(await readJson(req));
  if (!brief) return fail(400, 'That brief could not be read.');
  const result = await saveBrief(brief);
  if (!result.persisted) return fail(503, 'Your brief could not be saved just now. Try again shortly.');
  return json({ ok: true });
}
