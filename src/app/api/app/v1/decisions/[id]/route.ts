import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { pickOption } from '@/modules/project/decision-flow';

/**
 * POST /api/app/v1/decisions/:id — { optionId } (the app since Phase 5) or
 * { index } (older apps) picks an option. The pick changes the quote, the
 * final payment and the locker at once (project/decision-flow.ts). It can be
 * changed until the due date; a first pick after it is taken and counted as
 * the customer's delay.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const body = (await readJson(req)) as { index?: unknown; optionId?: unknown } | null;
  const result = await pickOption(me.user.id, id.slice(0, 40), { optionId: body?.optionId, index: body?.index });
  return result.ok ? json({ ok: true, message: result.message ?? null }) : fail(400, result.error);
}
