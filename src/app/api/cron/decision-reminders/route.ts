import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { notify } from '@/modules/notify/service';
import { daysLeft, needsReminder } from '@/modules/portal/decisions';
import { moneyView, paymentNeedsReminder, readMarks } from '@/modules/portal/payments';
import { fromDb } from '@/lib/money';

/**
 * GET /api/cron/decision-reminders — once a day (vercel.json, 09:30 IST):
 * tells each customer about a decision still open and due within two days,
 * once per decision, and about a payment stage due within two days, once per
 * stage (the studio or ops sets its date; trust fix 5).
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

  // Payment stages with a due date set, not yet paid.
  const signed = await prisma.homeProject.findMany({
    where: { contractPaise: { not: null }, paidPhases: { not: Prisma.DbNull } },
    select: {
      id: true,
      contractPaise: true,
      paymentPhases: true,
      paidPhases: true,
      introduction: { select: { brief: { select: { userId: true } }, studio: { select: { tradeName: true } } } },
    },
    take: 1000,
  });
  for (const p of signed) {
    const money = moneyView(p.contractPaise === null ? null : fromDb(p.contractPaise), p.paymentPhases, p.paidPhases);
    if (!money) continue;
    const marks = readMarks(p.paidPhases);
    const due = marks.filter((m) => paymentNeedsReminder(m, now));
    if (due.length === 0) continue;
    const stamped = marks.map((m) => (due.includes(m) ? { ...m, remindedAt: now.toISOString() } : m));
    // Marked first, as above.
    await prisma.homeProject.update({ where: { id: p.id }, data: { paidPhases: stamped as unknown as object } });
    const userId = p.introduction.brief.userId;
    if (!userId) continue;
    for (const m of due) {
      const stage = money.stages[m.index];
      if (!stage) continue;
      const dueLabel = new Date(`${m.dueOn}T12:00:00Z`)
        .toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
        .replace(',', '');
      await notify(userId, { kind: 'payment-due', stage: stage.label, amountPaise: stage.amountPaise, studio: p.introduction.studio.tradeName, dueLabel });
      reminded += 1;
    }
  }
  return Response.json({ ok: true, reminded });
}
