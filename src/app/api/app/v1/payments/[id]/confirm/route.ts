import { fail, gate, json, signedIn } from '@/modules/app-api/http';
import { confirmPayment } from '@/modules/project/payments-flow';

/**
 * POST /api/app/v1/payments/:id/confirm — the customer (owner of the brief)
 * says yes, this money arrived at the studio. One tap; once.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const result = await confirmPayment(me.user.id, id.slice(0, 64));
  return result.ok ? json({ ok: true }) : fail(400, result.error);
}
