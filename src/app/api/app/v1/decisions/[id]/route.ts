import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { chooseDecision } from '@/modules/portal/project-store';

/** POST /api/app/v1/decisions/:id — { index } chooses an option; it can be changed until the due date. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const body = (await readJson(req)) as { index?: unknown } | null;
  const result = await chooseDecision(me.user.id, id.slice(0, 40), body?.index);
  return result.ok ? json({ ok: true }) : fail(400, result.error);
}
