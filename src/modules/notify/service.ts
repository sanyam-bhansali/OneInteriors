import 'server-only';

/**
 * The notification service (docs/CUSTOMER-PLATFORM-PLAN.md, step 1).
 *
 * `notify(userId, event)` records the event in `notifications` (the app's
 * list, read on phone and laptop alike), then pushes it to every phone the
 * person is signed in on through Expo's push service. With no phone, it falls
 * back to a WhatsApp template when one is configured
 * (`WHATSAPP_PROJECT_TEMPLATE`, approved by Meta, two body parameters: title
 * and text).
 *
 * Never throws into the action that caused it: a failed push must not undo a
 * posted site update. Failures are logged without the message text, which can
 * carry a customer's details.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { sendTemplate } from '@/modules/auth/whatsapp';
import { messageFor, type Message, type ProjectEvent } from './messages';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

/** An Expo push token, as the app reports it. */
export function isExpoToken(token: unknown): token is string {
  return typeof token === 'string' && /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/.test(token);
}

export async function registerDevice(userId: string, token: string, platform: 'ios' | 'android'): Promise<void> {
  await prisma.pushDevice.upsert({
    where: { token },
    create: { userId, token, platform },
    // A phone passed to someone else signs in as them: the token moves.
    update: { userId, platform, lastSeenAt: new Date() },
  });
}

export async function removeDevice(userId: string, token: string): Promise<void> {
  await prisma.pushDevice.deleteMany({ where: { userId, token } });
}

export async function notify(userId: string, event: ProjectEvent): Promise<void> {
  if (!hasDatabase()) return;
  const msg = messageFor(event);
  try {
    const devices = await prisma.pushDevice.findMany({ where: { userId }, select: { token: true } });
    const pushed = devices.length > 0 ? await push(devices.map((d) => d.token), msg) : false;
    const whatsapped = !pushed ? await viaWhatsApp(userId, msg) : false;
    await prisma.notification.create({
      data: {
        userId,
        channel: pushed ? 'push' : whatsapped ? 'whatsapp' : 'inbox',
        template: msg.template,
        payload: { title: msg.title, body: msg.body, url: msg.url },
        sentAt: pushed || whatsapped ? new Date() : null,
      },
    });
  } catch (error) {
    console.error('[notify] failed', msg.template, error instanceof Error ? error.name : 'unknown');
  }
}

/** Everyone at a studio who should hear about its projects: its members with an account. */
export async function notifyStudio(studioId: string, event: ProjectEvent): Promise<void> {
  if (!hasDatabase()) return;
  try {
    const members = await prisma.studioMember.findMany({ where: { studioId }, select: { userId: true } });
    await Promise.all(members.map((m) => notify(m.userId, event)));
  } catch (error) {
    console.error('[notify] studio lookup failed', error instanceof Error ? error.name : 'unknown');
  }
}

/** Push to Expo; true when at least one phone accepted it. Tokens Expo reports as gone are deleted. */
async function push(tokens: string[], msg: Message): Promise<boolean> {
  let delivered = false;
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  const access = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (access) headers.authorization = `Bearer ${access}`;
  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch = tokens.slice(i, i + BATCH);
    const res = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers,
      body: JSON.stringify(
        batch.map((to) => ({ to, title: msg.title, body: msg.body, sound: 'default', data: { url: msg.url } })),
      ),
    }).catch(() => null);
    if (!res?.ok) {
      console.error('[notify] push service refused', res?.status ?? 'network');
      continue;
    }
    const json = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
    const gone: string[] = [];
    (json?.data ?? []).forEach((r, j) => {
      if (r.status === 'ok') delivered = true;
      else if (r.details?.error === 'DeviceNotRegistered') gone.push(batch[j]!);
    });
    if (gone.length) await prisma.pushDevice.deleteMany({ where: { token: { in: gone } } });
  }
  return delivered;
}

async function viaWhatsApp(userId: string, msg: Message): Promise<boolean> {
  const template = process.env.WHATSAPP_PROJECT_TEMPLATE?.trim();
  if (!template) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (!user?.phone) return false;
  const sent = await sendTemplate(user.phone, template, [msg.title, msg.body]);
  return sent.delivered;
}
