import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { answerExtra } from '@/modules/project/change-orders';

/**
 * POST /api/app/v1/extras/:id — { approve: true } or { approve: false, reason }.
 * The owner of the brief answers extra work the studio sent after design
 * sign-off (project/change-orders.ts). Approving puts its price on the final
 * payment stage; the client then pays the studio directly, as for any stage.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const body = (await readJson(req)) as { approve?: unknown; reason?: unknown } | null;
  const result = await answerExtra(me.user.id, id.slice(0, 64), { approve: body?.approve, reason: body?.reason });
  return result.ok ? json({ ok: true, message: result.message ?? null }) : fail(400, result.error);
}
