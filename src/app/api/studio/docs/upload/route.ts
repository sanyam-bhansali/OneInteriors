import { opening, reply } from '@/modules/project/site-http';
import { docUploadTicket } from '@/modules/studio-design/design-flow';

/**
 * POST /api/studio/docs/upload — { projectId, name, bytes } → { ok, path, url }:
 * a one-time signed URL the browser PUTs one project file to (a drawing set,
 * a cut list, a SketchUp model; up to 50 MB), straight into the private
 * `project-docs` bucket (DESIGN-PROCESS-PLAN.md §3.6). Only for somebody who
 * does design work on this project. `url: null` in local development with no
 * storage. The upload is then recorded with `uploadDocumentAction`, which
 * checks the path is this project's and the file arrived.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const open = await opening(req);
  if (!open.ok) return open.response;
  const o = open.body as Record<string, unknown>;
  const projectId = typeof o.projectId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(o.projectId) ? o.projectId : null;
  if (!projectId) return reply({ ok: false, error: 'That project is not one of yours.' }, 400);
  const ticket = await docUploadTicket(projectId, o.name, o.bytes);
  if (!ticket.ok) return reply({ ok: false, error: ticket.error }, 400);
  return reply({ ok: true, path: ticket.path, url: ticket.url });
}
