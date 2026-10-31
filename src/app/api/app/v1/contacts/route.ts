import { gate, json, signedIn } from '@/modules/app-api/http';
import { projectContacts } from '@/modules/portal/project-contacts';

/**
 * GET /api/app/v1/contacts — { studio, contacts: [{ name, role, phone }] } or
 * { studio: null }. The Chats tab until chat is built (owner, 1 Nov 2026):
 * who to call about the client's home, their designer first.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const view = await projectContacts(me.user.id);
  return json({ ok: true, studio: view?.studio ?? null, contacts: view?.contacts ?? [] });
}
