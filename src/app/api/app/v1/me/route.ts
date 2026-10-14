import { prisma } from '@/lib/prisma';
import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { homeBriefFor } from '@/modules/app/customer-home';
import { homeSummary } from '@/modules/app/home-summary';
import { expertFirstName } from '@/modules/app/geio-input';
import { appLocale, isAppLocale } from '@/modules/app/locale';
import { settleCoins, wallet } from '@/modules/engagement/coins';
import { eraseAccount } from '@/modules/auth/erase';
import { customerPlan } from '@/modules/portal/plan-store';

/**
 * GET    /api/app/v1/me — who this token belongs to, and what the "Me" tab and
 *        Home header show: their home, Home Coins, their expert, unread
 *        notices, their language and their plan (null before they sign
 *        with a studio; portal/plans.ts). 401 means sign in again.
 * PATCH  /api/app/v1/me — `{ locale: 'en' | 'hi' | 'mr' }`.
 * DELETE /api/app/v1/me — delete the account (Me → Privacy → Delete my
 *        account). See modules/auth/erase.ts for what goes and what stays.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id, name, phone } = me.user;

  // The same settle-then-read as the website's wallet, so both show one balance.
  await settleCoins(id);
  const [brief, coins, unread, row, plan] = await Promise.all([
    homeBriefFor(id),
    wallet(id),
    prisma.notification.count({ where: { userId: id, readAt: null } }),
    prisma.user.findUnique({ where: { id }, select: { locale: true } }),
    customerPlan(id),
  ]);
  return json({
    ok: true,
    user: { id, name, phone },
    home: homeSummary(brief),
    coins: { balance: coins.balance, streak: coins.streak },
    expert: { name: expertFirstName() },
    unread,
    locale: appLocale(row?.locale),
    plan,
  });
}

export async function PATCH(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await readJson(req)) as { locale?: unknown } | null;
  if (!isAppLocale(body?.locale)) return fail(400, 'Choose English, Hindi or Marathi.');
  await prisma.user.update({ where: { id: me.user.id }, data: { locale: body.locale } });
  return json({ ok: true });
}

export async function DELETE() {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const result = await eraseAccount(me.user.id);
  if (!result.ok) return fail(404, 'That account was not found.');
  return json({ ok: true });
}
