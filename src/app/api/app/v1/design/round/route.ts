import { drawRound } from '@/modules/design-dna/store';
import { fail, gate, json, readJson, signedIn, str } from '@/modules/app-api/http';

/** POST /api/app/v1/design/round — { room } → three new room ideas drawn from the DNA. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await readJson(req)) as Record<string, unknown> | null;
  const result = await drawRound(str(body?.room, 40));
  return result.ok ? json({ ok: true, drawn: result.drawn }) : fail(400, result.error);
}
