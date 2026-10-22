import { hasDatabase } from '@/lib/env';
import { runMorningDigest } from '@/modules/studio/my-work';

/**
 * GET /api/cron/today-email — the morning digest (Studio OS Phase 1's Today
 * email, extended by My work, owner 15 Oct 2026). vercel.json runs it once a
 * day at 02:30 UTC (08:00 IST; Vercel Hobby allows once-a-day crons only).
 * Every active studio member gets their Today and Missed in the app and by
 * email — the owner, a PM and sales with the rest of their leads Today list
 * in the same email — and someone with no email through the studio
 * MessageSender. Nobody gets one with nothing in it; each goes once a day.
 * To the studio's own people only, never to a customer or a lead.
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
  const run = await runMorningDigest();
  return Response.json({ ok: true, ...run });
}
