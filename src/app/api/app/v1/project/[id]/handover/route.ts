import { fail, gate, json, signedIn } from '@/modules/app-api/http';
import { signOffHandover } from '@/modules/project/snag-flow';

/**
 * POST /api/app/v1/project/:id/handover — the customer signs off the
 * handover once every snag is closed (owner, 13 Oct 2026; docs/studio-os/
 * PROJECT-LIFECYCLE.md). Only the owner of the brief; refused while a snag
 * is open. The project moves to its warranty; the reply gives the day the
 * warranty ends.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const result = await signOffHandover(me.user.id, id.slice(0, 64));
  return result.ok ? json({ ok: true, warrantyEndsOn: result.warrantyEndsOn }) : fail(400, result.error);
}
