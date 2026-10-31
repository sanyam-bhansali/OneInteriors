import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { castVote } from '@/modules/project/decision-flow';

/**
 * POST /api/app/v1/decisions/:id/vote — { optionId, note? } a family member's
 * vote. Advice to the owner, whose pick decides.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const body = (await readJson(req)) as { optionId?: unknown; index?: unknown; note?: unknown } | null;
  const result = await castVote(me.user.id, id.slice(0, 40), { optionId: body?.optionId, index: body?.index }, body?.note);
  return result.ok ? json({ ok: true }) : fail(400, result.error);
}
