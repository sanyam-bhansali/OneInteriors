import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { answerVisit } from '@/modules/portal/choose';

/**
 * POST /api/app/v1/choose/visits/:id — `{ answer: 'confirm' | 'cancel' }` →
 * `{ ok }`. Yes or no to a time the studio proposed, on the customer's own
 * introduction only (`answerVisit`, as the website). 409 when it is not
 * theirs or already settled.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const answer = ((await readJson(req)) as { answer?: unknown } | null)?.answer;
  if (answer !== 'confirm' && answer !== 'cancel') return fail(400, 'Confirm or cancel.');
  const { id } = await params;
  const r = await answerVisit(id.slice(0, 64), answer === 'confirm' ? 'CONFIRMED' : 'CANCELLED');
  return r.ok ? json({ ok: true }) : fail(409, r.error);
}
