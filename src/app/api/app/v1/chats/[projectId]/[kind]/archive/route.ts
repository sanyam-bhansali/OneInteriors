import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { archiveThread } from '@/modules/chat/store';

/** POST /api/app/v1/chats/:projectId/:kind/archive — { archive: boolean }. Archive a conversation for myself, or bring it back (modules/chat). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; kind: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { projectId, kind } = await params;
  const b = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const r = await archiveThread(me.user, projectId, kind.toUpperCase(), b.archive !== false);
  return r.ok ? json({ ok: true, ...r.value }) : fail(r.reason === 'not_yours' ? 403 : r.reason === 'not_found' ? 404 : 400, r.error);
}
