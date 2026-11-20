import { fail, gate, json, signedIn } from '@/modules/app-api/http';
import { AFTERCARE_ERRORS, aftercareView } from '@/modules/aftercare/store';

/**
 * GET /api/app/v1/aftercare?projectId=… — after the handover (owner, 20 Nov
 * 2026; docs/studio-os/AFTERCARE.md): whether the project is fully paid
 * (`payments`), the warranty's areas, the studio's service categories with
 * their visiting charges, the bookable 2-hour slots from 5 days ahead, and
 * the client's claims and visits. Both options always show; the payment
 * gate refuses on submit. Max studios only for now (404 otherwise).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const projectId = (new URL(req.url).searchParams.get('projectId') ?? '').slice(0, 64);
  const r = await aftercareView(me.user.id, projectId);
  return r.ok ? json({ ok: true, ...r.view }) : fail(r.error === AFTERCARE_ERRORS.notOpen ? 404 : 403, r.error);
}
