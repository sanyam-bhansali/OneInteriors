import { gate, json, signedIn } from '@/modules/app-api/http';
import { loadBrief } from '@/modules/brief/repository';
import { storeSaves } from '@/modules/discover/saves';

/**
 * POST /api/app/v1/discover/saves — keep the phone's saves on the Home
 * Profile (the same list the website shows and the expert reads). Body:
 * { saved }. Without a Home Profile nothing is stored: `stored: false`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await req.json().catch(() => ({}))) as { saved?: unknown };
  const { found, id } = await loadBrief();
  if (!found || !id) return json({ ok: true, stored: false });
  const saved = await storeSaves(id, body.saved);
  return json({ ok: true, stored: true, saved });
}
