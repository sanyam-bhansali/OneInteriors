import { gate, json, signedIn } from '@/modules/app-api/http';
import { chatList, searchChats } from '@/modules/chat/store';

/**
 * GET /api/app/v1/chats — { chats: [{ projectId, kind, title, last, unread, archived }], unread }.
 * GET /api/app/v1/chats?archived=1 — the conversations this person archived.
 * GET /api/app/v1/chats?q=words — { hits: [{ projectId, kind, title, from, preview, at }] }.
 *
 * In-app chat (owner, 1 Nov 2026; modules/chat): every conversation the
 * signed-in person takes part in, newest first. A client sees all three of
 * theirs, ready to start; a studio person and our team see the ones that
 * have started. Fetching the list marks its messages delivered.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  if (q !== null) return json({ ok: true, hits: await searchChats(me.user, q) });
  const chats = await chatList(me.user, { archived: url.searchParams.get('archived') === '1' });
  return json({ ok: true, chats, unread: chats.reduce((n, c) => n + c.unread, 0) });
}
