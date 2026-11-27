import { savePrepRoom } from '@/modules/prepare/prep';
import { fail, gate, json, readJson, signedIn, str } from '@/modules/app-api/http';

/** PUT /api/app/v1/design/board — { room, items } → one room's mood board, from the app. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await readJson(req)) as Record<string, unknown> | null;
  const items = Array.isArray(body?.items) ? body.items.filter((s): s is string => typeof s === 'string').slice(0, 40) : null;
  if (!items) return fail(400, 'That board could not be read.');
  const result = await savePrepRoom(str(body?.room, 40), { items });
  return result.ok ? json({ ok: true }) : fail(400, result.error);
}
