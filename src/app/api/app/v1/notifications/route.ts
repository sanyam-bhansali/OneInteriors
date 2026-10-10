import { prisma } from '@/lib/prisma';
import { gate, json, readJson, signedIn } from '@/modules/app-api/http';

/**
 * GET  /api/app/v1/notifications — the latest 50, newest first, with how many are unread.
 * POST /api/app/v1/notifications — { ids } marks those read; { all: true } marks everything.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: me.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, template: true, payload: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId: me.user.id, readAt: null } }),
  ]);
  return json({ ok: true, unread, notifications: rows });
}

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await readJson(req)) as { ids?: unknown; all?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((i): i is string => typeof i === 'string').slice(0, 100) : [];
  if (body?.all !== true && ids.length === 0) return json({ ok: true });
  await prisma.notification.updateMany({
    where: { userId: me.user.id, readAt: null, ...(body?.all === true ? {} : { id: { in: ids } }) },
    data: { readAt: new Date() },
  });
  return json({ ok: true });
}
