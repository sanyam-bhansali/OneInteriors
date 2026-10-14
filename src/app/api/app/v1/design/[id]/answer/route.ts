import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { answerDrawing } from '@/modules/studio-design/design-flow';

/**
 * POST /api/app/v1/design/:id/answer — { verdict: 'APPROVED' | 'CHANGES',
 * comment? } the customer approves a shared drawing (2D layout, furniture
 * layout, 3D render) or asks for changes, with what to change. Only the
 * owner of the brief, and only the newest version (studio-design/design-flow.ts).
 * Studio OS Phase 2, docs/studio-os/PHASE-2-DESIGN.md §5.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const body = (await readJson(req)) as { verdict?: unknown; comment?: unknown } | null;
  const result = await answerDrawing(me.user.id, id.slice(0, 64), body?.verdict, typeof body?.comment === 'string' ? body.comment.slice(0, 1200) : '');
  return result.ok ? json({ ok: true, id: result.id }) : fail(400, result.error);
}
