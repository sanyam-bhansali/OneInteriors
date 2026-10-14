import { appData } from '@/modules/app/app-data';
import { studioProfile } from '@/modules/app/journey-view';
import { fail, gate, json, limitByIp } from '@/modules/app-api/http';

/**
 * GET /api/app/v1/studios/:slug — one listed studio's profile: past homes,
 * checks with their source and date, delivery record, verified reviews.
 * 404 for a studio that is not listed (paused, unverified or unknown), so a
 * slug cannot read a studio we do not show. Public, limited per IP.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const g = gate();
  if (!g.ok) return g.response;
  const limited = await limitByIp(req, 'journey');
  if (limited) return limited;
  const { slug } = await params;
  const studio = studioProfile(slug.slice(0, 120), await appData());
  return studio ? json({ ok: true, studio }) : fail(404, 'We could not find that studio. It may have paused new work.');
}
