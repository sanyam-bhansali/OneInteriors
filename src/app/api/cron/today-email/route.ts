import { hasDatabase } from '@/lib/env';
import { sendTodayEmails } from '@/modules/studio-sales/today';

/**
 * GET /api/cron/today-email — the morning email (Studio OS Phase 1): each
 * owner, project manager and salesperson with an email address gets their
 * own Today list. vercel.json runs it at 02:30 UTC (08:00 IST). Nobody gets
 * an email with nothing on it. To the studio's own people only.
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
  if (!hasDatabase()) return Response.json({ ok: true, sent: 0 });
  const run = await sendTodayEmails();
  return Response.json({ ok: true, ...run });
}
