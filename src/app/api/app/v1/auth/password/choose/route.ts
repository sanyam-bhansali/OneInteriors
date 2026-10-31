import { chooseCustomerPassword } from '@/modules/auth/customer-password';
import { fail, gate, json, readJson, signedIn, str } from '@/modules/app-api/http';

/**
 * POST /api/app/v1/auth/password/choose — { password, current? } → { ok }.
 * The client replaces the studio's one-time password with their own (no
 * `current` needed then), or changes their own (`current` required).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await readJson(req)) as Record<string, unknown> | null;
  const current = str(body?.current, 200);
  const r = await chooseCustomerPassword(me.user.id, str(body?.password, 200), current || null);
  return r.ok ? json({ ok: true }) : fail(400, r.message);
}
