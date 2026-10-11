import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { reportNotFixed } from '@/modules/project/snag-flow';

/**
 * POST /api/app/v1/snags/:id/not-fixed — { reason? } the customer says the
 * fix did not work. The snag reopens and goes back to the studio. Only the
 * owner of the brief (project/snag-flow.ts).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const body = (await readJson(req)) as { reason?: unknown } | null;
  const result = await reportNotFixed(me.user.id, id.slice(0, 64), body?.reason);
  return result.ok ? json({ ok: true, id: result.id }) : fail(400, result.error);
}
