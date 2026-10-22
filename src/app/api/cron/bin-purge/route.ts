import { hasDatabase } from '@/lib/env';
import { purgeBin } from '@/modules/studio-sales/bin-purge';
import { retryConversions } from '@/modules/studio-sales/conversions';

/**
 * GET /api/cron/bin-purge — erase leads deleted more than thirty days ago,
 * with their files (Studio OS Phase 1; the bin screen promises it).
 * vercel.json runs it daily at 21:30 UTC (03:00 IST). Erasing what is due is
 * all it does, so an extra run is harmless.
 *
 * It also retries Meta conversion feedback that did not go through (owner,
 * 22 Oct 2026; studio-sales/conversions.ts): events still QUEUED or FAILED,
 * five tries in all. Here rather than on a schedule of its own because Vercel
 * Hobby runs crons at most once a day and the nightly lead housekeeping is
 * the natural home; a retry that finds nothing due does nothing. Run after
 * the purge, so an event about a lead just erased has gone with it.
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
  const conversions = await retryConversions();
  return Response.json({ ok: true, ...run, conversions });
}
