import { hasDatabase } from '@/lib/env';
import { runSiteReminders } from '@/modules/project/site-reminders';
import { runEveningNotices } from '@/modules/studio/my-work';

/**
 * GET /api/cron/site-reminders — the daily-update reminders (studio
 * workspace Phase 2). vercel.json runs it at 12:30 and 15:30 UTC, which is
 * 18:00 and 21:00 IST; what is due at each run is decided from the time
 * (modules/project/reminder-rules.ts), and each reminder is sent once, so an
 * extra or late run is harmless.
 *
 * The 18:00 run also sends My work's evening notices (owner, 15 Oct 2026;
 * studio/my-work.ts `runEveningNotices`): in the app, to studio staff, what
 * is due tomorrow and the steps someone else completed today. Folded in here
 * rather than a new cron (Vercel Hobby: once-a-day jobs only); it decides by
 * the time and sends each notice once a day, so the 21:00 run adds nothing.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Without that secret
 * set, the route does nothing for anyone.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!hasDatabase()) return Response.json({ ok: true, projects: 0 });
  const run = await runSiteReminders();
  const evening = await runEveningNotices().catch(() => null);
  return Response.json({ ok: true, ...run, evening });
}
