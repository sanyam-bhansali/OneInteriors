import { gate, json, signedIn } from '@/modules/app-api/http';
import { applyStyle } from '@/modules/discover/server';

/**
 * POST /api/app/v1/discover/style — "Use this style in my Home Profile" from
 * the phone. Body: { styles, studioIds }.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await req.json().catch(() => ({}))) as { styles?: unknown; studioIds?: unknown };
  return json({ ok: true, saved: await applyStyle(body.styles, body.studioIds) });
}
