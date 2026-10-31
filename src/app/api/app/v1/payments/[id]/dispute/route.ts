import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { disputePayment } from '@/modules/project/payments-flow';

/**
 * POST /api/app/v1/payments/:id/dispute — { note? } the customer says "I
 * didn't pay this". It goes to our team (ops) with their words; the studio
 * sees only that it is being looked into.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const body = (await readJson(req)) as { note?: unknown } | null;
  const result = await disputePayment(me.user.id, id.slice(0, 64), body?.note);
  return result.ok ? json({ ok: true }) : fail(400, result.error);
}
