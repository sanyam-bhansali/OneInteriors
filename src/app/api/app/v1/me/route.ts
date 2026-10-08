import { gate, json, signedIn } from '@/modules/app-api/http';

/** GET /api/app/v1/me — who this token belongs to. 401 means sign in again. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id, name, phone } = me.user;
  return json({ ok: true, user: { id, name, phone } });
}
