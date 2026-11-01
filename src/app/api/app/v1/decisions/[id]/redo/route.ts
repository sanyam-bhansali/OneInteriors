import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { askForOtherOptions } from '@/modules/project/decision-flow';

/**
 * POST /api/app/v1/decisions/:id/redo — { note }. "None of these: show me
 * other options" (the owner's v1 screens, Redo; owner, 1 Nov 2026). Only the
 * home's owner, before they pick.
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
  const r = await askForOtherOptions(me.user.id, id, b.note);
  return r.ok ? json({ ok: true }) : fail(400, r.error);
}
