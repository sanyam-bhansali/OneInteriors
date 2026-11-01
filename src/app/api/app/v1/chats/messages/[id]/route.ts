import { fail, gate, json, signedIn } from '@/modules/app-api/http';
import { takeBack } from '@/modules/chat/store';

/** DELETE /api/app/v1/chats/messages/:id — take back my own message within the hour (modules/chat). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const r = await takeBack(me.user, id);
  return r.ok ? json({ ok: true }) : fail(r.reason === 'not_found' ? 404 : r.reason === 'not_yours' ? 403 : 400, r.error);
}
