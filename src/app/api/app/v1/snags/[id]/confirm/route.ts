import { fail, gate, json, signedIn } from '@/modules/app-api/http';
import { confirmSnag } from '@/modules/project/snag-flow';

/**
 * POST /api/app/v1/snags/:id/confirm — the customer confirms the studio's fix
 * (or agrees with the studio's reason on a disputed snag). The snag closes.
 * Only the owner of the brief; family can see, not close (project/snag-flow.ts).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const result = await confirmSnag(me.user.id, id.slice(0, 64));
  return result.ok ? json({ ok: true, id: result.id }) : fail(400, result.error);
}
