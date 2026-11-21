import { opening, reply } from '@/modules/project/site-http';
import { previewAgreementPdf } from '@/modules/agreement/store';

/**
 * POST /api/studio/agreement/preview — { projectId, clientName, relation,
 * address, pan, siteAddress, date } → the filled agreement as a PDF, not
 * saved: what the client will be sent (docs/studio-os/CLIENT-AGREEMENT.md).
 * The owner, PM or the project's designer.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const open = await opening(req);
  if (!open.ok) return open.response;
  const o = open.body as Record<string, unknown>;
  const projectId = typeof o.projectId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(o.projectId) ? o.projectId : null;
  if (!projectId) return reply({ ok: false, error: 'That project is not one of yours.' }, 400);
  const r = await previewAgreementPdf(projectId, o);
  if (!r.ok) return reply({ ok: false, error: r.error }, 400);
  return new Response(Buffer.from(r.pdf), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="agreement-preview.pdf"', 'cache-control': 'no-store' },
  });
}
