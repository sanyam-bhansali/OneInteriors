import { fail, gate, json, signedIn } from '@/modules/app-api/http';
import { disputePayment } from '@/modules/project/payments-flow';

/**
 * POST /api/app/v1/payments/:id/dispute — kept for phone builds from before
 * 22 Nov 2026 that still show "I didn't pay this". Payments are marked by
 * the team now (owner), so a new dispute is refused with a plain sentence
 * (payments-flow.ts `disputePayment`). Nothing in the app calls it.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const result = await disputePayment(me.user.id, id.slice(0, 64));
  return result.ok ? json({ ok: true }) : fail(400, result.error);
}
