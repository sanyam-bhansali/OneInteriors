import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/modules/auth/session';

/**
 * The studio bell (owner, 20 Nov 2026: "notification should pop for every
 * approval"): the signed-in person's unread notices with a studio link, newest
 * first, and how many. GET is polled by the bell; POST marks one read
 * (`{ id }`) or all (`{ all: true }`). Only their own rows.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const rows = await prisma.notification.findMany({
    where: { userId: user.id, readAt: null },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true, payload: true, createdAt: true },
  });
  const items = rows.flatMap((r) => {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    // Only studio links: a customer-app path is not theirs to open.
    if (typeof p.title !== 'string' || typeof p.url !== 'string' || !p.url.startsWith('/studio')) return [];
    return [{ id: r.id, title: p.title, body: typeof p.body === 'string' ? p.body : '', url: p.url, at: r.createdAt.toISOString() }];
  });
  return NextResponse.json({ ok: true, unread: items.length, items: items.slice(0, 20) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; all?: unknown };
  if (body.all === true) {
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  } else if (typeof body.id === 'string') {
    await prisma.notification.updateMany({ where: { id: body.id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  }
  return NextResponse.json({ ok: true });
}
