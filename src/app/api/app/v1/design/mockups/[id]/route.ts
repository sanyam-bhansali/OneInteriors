import { answerMockup } from '@/modules/design-dna/store';
import { fail, gate, json, readJson, signedIn, str } from '@/modules/app-api/http';

/** POST /api/app/v1/design/mockups/:id — { verdict: "up" | "down", reason? } → their answer on one room idea. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await ctx.params;
  const body = (await readJson(req)) as Record<string, unknown> | null;
  const reason = str(body?.reason, 40) || null;
  const result = await answerMockup(id, str(body?.verdict, 8), reason);
  return result.ok ? json({ ok: true }) : fail(400, result.error);
}
