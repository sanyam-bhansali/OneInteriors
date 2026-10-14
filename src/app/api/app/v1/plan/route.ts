import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { requestAssured } from '@/modules/portal/plan-store';

/**
 * POST /api/app/v1/plan — `{ plan: 'assured' }` → `{ ok, plan, assuredRequested }`.
 *
 * Asking for Assured after signing (from Me, or the locked GEIO card). It
 * registers interest only: the project stays on Basic, ops is told once and
 * switches it after confirming the fee. Already on Assured: `plan: 'assured'`,
 * `assuredRequested: false`. 409 before signing; 403 for a family member.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await readJson(req)) as { plan?: unknown } | null;
  if (body?.plan !== 'assured') return fail(400, 'Only Assured can be asked for. Basic is where every project starts.');
  const r = await requestAssured(me.user);
  return r.ok ? json(r) : fail(r.status, r.error);
}
