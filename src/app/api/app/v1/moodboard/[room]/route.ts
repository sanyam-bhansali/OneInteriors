import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { savePrepRoom } from '@/modules/prepare/prep';

/**
 * POST /api/app/v1/moodboard/:room — { shuffle?, chosenOption?, note?, items? }.
 * Saves one room of the client's own mood board from the phone app (1 Nov
 * 2026). The brief is the signed-in person's own, found on the server; no id
 * is taken from the phone (prepare/prep.ts `savePrepRoom`).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ room: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { room } = await params;
  const b = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const patch: { shuffle?: number; chosenOption?: number | null; note?: string; items?: string[] } = {};
  if (typeof b.shuffle === 'number') patch.shuffle = b.shuffle;
  if (b.chosenOption === null || typeof b.chosenOption === 'number') patch.chosenOption = b.chosenOption as number | null;
  if (typeof b.note === 'string') patch.note = b.note;
  if (Array.isArray(b.items)) patch.items = b.items.filter((x): x is string => typeof x === 'string').slice(0, 40);
  const r = await savePrepRoom(String(room).slice(0, 40), patch);
  return r.ok ? json({ ok: true }) : fail(400, r.error);
}
