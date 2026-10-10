import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { isExpoToken, registerDevice, removeDevice } from '@/modules/notify/service';

/**
 * POST   /api/app/v1/devices — { token, platform } registers this phone for push.
 * DELETE /api/app/v1/devices — { token } stops it, on sign-out.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await readJson(req)) as { token?: unknown; platform?: unknown } | null;
  if (!isExpoToken(body?.token)) return fail(400, 'That is not a push token.');
  if (body?.platform !== 'ios' && body?.platform !== 'android') return fail(400, 'Which phone is this?');
  await registerDevice(me.user.id, body.token, body.platform);
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await readJson(req)) as { token?: unknown } | null;
  if (isExpoToken(body?.token)) await removeDevice(me.user.id, body.token);
  return json({ ok: true });
}
