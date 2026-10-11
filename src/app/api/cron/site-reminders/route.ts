import { hasDatabase } from '@/lib/env';
import { runSiteReminders } from '@/modules/project/site-reminders';

/**
 * GET /api/cron/site-reminders — the daily-update reminders (studio
 * workspace Phase 2). vercel.json runs it at 12:30 and 15:30 UTC, which is
 * 18:00 and 21:00 IST; what is due at each run is decided from the time
 * (modules/project/reminder-rules.ts), and each reminder is sent once, so an
 * extra or late run is harmless.
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
  if (!hasDatabase()) return Response.json({ ok: true, projects: 0 });
  const run = await runSiteReminders();
  return Response.json({ ok: true, ...run });
}
