import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { answerVisit } from '@/modules/studio-design/design-flow';

/**
 * POST /api/app/v1/visits/:id — { answer: 'confirm' | 'move', reason? }.
 * The client answers a site visit the designer booked (owner, 1 Nov 2026;
 * customer app Phase 2): they will be there, or they ask for another day and
 * say why. Only the home's owner.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const b = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const r = await answerVisit(me.user.id, id, b.answer, b.reason);
  return r.ok ? json({ ok: true, message: r.message ?? null }) : fail(400, r.error);
}
