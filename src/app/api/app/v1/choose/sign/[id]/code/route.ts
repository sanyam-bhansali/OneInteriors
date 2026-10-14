import { clientIp, fail, gate, json, signedIn } from '@/modules/app-api/http';
import { requestSignCode } from '@/modules/portal/sign';

/**
 * POST /api/app/v1/choose/sign/:id/code → `{ ok, devCode? }`: a 6-digit
 * WhatsApp code to the number on their account, to sign with. Always their
 * own number. `devCode` only where the website's sign-in shows it too.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const r = await requestSignCode(me.user, clientIp(req));
  return r.ok ? json({ ok: true, devCode: r.devCode }) : fail(400, r.error);
}
