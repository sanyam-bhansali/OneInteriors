import { hasDatabase } from '@/lib/env';
import { autoCloseSnags } from '@/modules/project/snag-flow';

/**
 * GET /api/cron/snag-auto-close — once a day (vercel.json, 10:00 IST): closes
 * every snag fixed seven or more days ago that the customer never answered,
 * writing the AUTO_CLOSED event (actor SYSTEM) and telling the customer
 * (studio workspace Phase 4). The status already reads as closed from the
 * seventh day (project/snag-status.ts), so a late run changes nothing the
 * customer or the studio sees except the notice. Safe to run twice: each
 * close is written once (dedupe key).
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Without that secret set,
 * the route does nothing for anyone.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!hasDatabase()) return Response.json({ ok: true, closed: 0 });
  const { closed } = await autoCloseSnags(new Date());
  return Response.json({ ok: true, closed });
}
