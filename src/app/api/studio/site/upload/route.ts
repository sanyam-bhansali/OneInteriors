import { ACCESS_ERRORS, memberOnProject } from '@/modules/studio/access';
import { opening, refuse, reply } from '@/modules/project/site-http';
import { uploadTicket } from '@/modules/project/site-log-storage';

/**
 * POST /api/studio/site/upload — { projectId, kind: 'site' | 'voice', contentType }
 * → { ok, path, url }: a one-time signed URL the phone PUTs one photo or
 * voice note to, straight into the private bucket (site-log-storage.ts).
 * Only for a member who may post on that project (`update.post`).
 * `url: null` in local development with no storage: nothing to upload.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const open = await opening(req);
  if (!open.ok) return open.response;
  const o = open.body as Record<string, unknown>;
  const projectId = typeof o.projectId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(o.projectId) ? o.projectId : null;
  const kind = o.kind === 'site' || o.kind === 'voice' ? o.kind : null;
  const contentType = typeof o.contentType === 'string' ? o.contentType.slice(0, 80) : '';
  if (!projectId || !kind) return refuse('invalid');
  const check = await memberOnProject(projectId, 'update.post');
  if (!check.ok) return refuse(check.error === ACCESS_ERRORS.signIn ? 'sign_in' : check.error === ACCESS_ERRORS.notYourRole ? 'not_your_role' : 'not_yours');
  const ticket = await uploadTicket(projectId, kind, contentType);
  if (!ticket.ok) return reply({ ok: false, error: ticket.error }, ticket.error === 'type' ? 400 : 503);
  return reply({ ok: true, path: ticket.path, url: ticket.url });
}
