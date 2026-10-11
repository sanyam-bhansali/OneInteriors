import { opening, reply } from '@/modules/project/site-http';
import { leadFileTicket } from '@/modules/studio-sales/leads';

/**
 * POST /api/studio/leads/upload — { clientId, contentType, bytes } →
 * { ok, path, url }: a one-time signed URL the browser PUTs one lead file to
 * (a floor plan, up to 15 MB), straight into the private `lead-files` bucket
 * (storage/lead-files.ts). Only for somebody who may work this lead (a
 * salesperson: their own). `url: null` in local development with no storage.
 * The upload is then recorded with `attachLeadFileAction`, which checks the
 * path belongs to the lead and the file arrived.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const open = await opening(req);
  if (!open.ok) return open.response;
  const o = open.body as Record<string, unknown>;
  const clientId = typeof o.clientId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(o.clientId) ? o.clientId : null;
  if (!clientId) return reply({ ok: false, error: 'That lead is not one of yours.' }, 400);
  const ticket = await leadFileTicket(clientId, o.contentType, o.bytes);
  if (!ticket.ok) return reply({ ok: false, error: ticket.error }, 400);
  return reply({ ok: true, path: ticket.path, url: ticket.url });
}
