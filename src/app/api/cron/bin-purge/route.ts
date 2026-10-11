import { hasDatabase } from '@/lib/env';
import { purgeBin } from '@/modules/studio-sales/bin-purge';

/**
 * GET /api/cron/bin-purge — erase leads deleted more than thirty days ago,
 * with their files (Studio OS Phase 1; the bin screen promises it).
 * vercel.json runs it daily at 21:30 UTC (03:00 IST). Erasing what is due is
 * all it does, so an extra run is harmless.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Without that secret
 * set, the route does nothing for anyone.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!hasDatabase()) return Response.json({ ok: true, erased: 0 });
  const run = await purgeBin();
  return Response.json({ ok: true, ...run });
}
