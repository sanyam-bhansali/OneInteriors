import { fail, gate, json, signedIn } from '@/modules/app-api/http';
import { messageToSnag } from '@/modules/chat/store';

/** POST /api/app/v1/chats/messages/:id/snag — the studio turns a client's chat message into a snag (modules/chat). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const r = await messageToSnag(me.user, id);
  return r.ok ? json({ ok: true, ...r.value }) : fail(r.reason === 'not_yours' ? 403 : r.reason === 'not_found' ? 404 : 400, r.error);
}
