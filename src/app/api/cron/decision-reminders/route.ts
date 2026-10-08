import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { notify } from '@/modules/notify/service';
import { daysLeft, needsReminder } from '@/modules/portal/decisions';

/**
 * GET /api/cron/decision-reminders — once a day (vercel.json, 09:30 IST):
 * tells each customer about a decision still open and due within two days,
 * once per decision.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Without that secret set,
 * the route does nothing for anyone.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 86_400_000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!hasDatabase()) return Response.json({ ok: true, reminded: 0 });

  const now = new Date();
  const due = await prisma.homeDecision.findMany({
    where: { chosenIndex: null, remindedAt: null, dueOn: { gte: now, lte: new Date(now.getTime() + 3 * DAY) } },
    select: {
      id: true,
      title: true,
      dueOn: true,
      chosenIndex: true,
      remindedAt: true,
      project: { select: { introduction: { select: { brief: { select: { userId: true } } } } } },
    },
    take: 500,
  });

  let reminded = 0;
  for (const d of due) {
    if (!needsReminder(d, now)) continue;
    const userId = d.project.introduction.brief.userId;
    // Marked first, so a slow push can never send the same reminder twice.
    await prisma.homeDecision.update({ where: { id: d.id }, data: { remindedAt: now } });
    if (userId) await notify(userId, { kind: 'decision-due', decisionId: d.id, title: d.title, daysLeft: daysLeft(d.dueOn, now) });
    reminded += 1;
  }
  return Response.json({ ok: true, reminded });
}
