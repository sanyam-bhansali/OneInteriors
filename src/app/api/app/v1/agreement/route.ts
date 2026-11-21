import { fail, gate, json, signedIn } from '@/modules/app-api/http';
import { clientAgreementView } from '@/modules/agreement/store';

/**
 * GET /api/app/v1/agreement?projectId=… — the client's agreement
 * (docs/studio-os/CLIENT-AGREEMENT.md): `state` none | sent | signed, the
 * PDF to read, and `signUrl` (the owner of the brief only) to sign it with
 * Aadhaar eSign. Website and Expo app alike.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const projectId = (new URL(req.url).searchParams.get('projectId') ?? '').slice(0, 64);
  const r = await clientAgreementView(me.user.id, projectId);
  return r.ok ? json({ ok: true, ...r.view }) : fail(403, r.error);
}
