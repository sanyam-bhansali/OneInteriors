import 'server-only';

/**
 * The welcome, on the channel they joined with (the owner: WhatsApp Business
 * and email are both ready). WhatsApp needs an approved UTILITY template —
 * its name in WHATSAPP_WAITLIST_TEMPLATE (default `oi_waitlist_welcome`),
 * body parameters {{1}} first name, {{2}} place in the queue, {{3}} their
 * link. See docs/LAUNCH-KIT.md in the waitlist project for the wording.
 *
 * Never throws, never fails a signup.
 */

import { sendTemplate } from '@/modules/auth/whatsapp';
import { sendWaitlistWelcomeEmail } from '@/modules/auth/email';

const SITE = process.env.WAITLIST_SITE_URL?.trim() || 'https://oneinteriors.in';

export function referralLink(code: string): string {
  return `${SITE}/?r=${code}`;
}

export async function sendWaitlistWelcome(p: {
  name: string;
  phone: string | null;
  email: string | null;
  code: string;
  position: number | null;
}): Promise<{ delivered: boolean; channel: 'whatsapp' | 'email' | null }> {
  const first = p.name.split(/\s+/)[0] ?? p.name;
  const link = referralLink(p.code);
  try {
    if (p.phone) {
      const template = process.env.WHATSAPP_WAITLIST_TEMPLATE?.trim() || 'oi_waitlist_welcome';
      const r = await sendTemplate(p.phone, template, [first, p.position ? `#${p.position}` : 'on the list', link]);
      return { delivered: r.delivered, channel: r.delivered ? 'whatsapp' : null };
    }
    if (p.email) {
      const r = await sendWaitlistWelcomeEmail(p.email, first, p.position, link);
      return { delivered: r.delivered, channel: r.delivered ? 'email' : null };
    }
  } catch {
    // fall through
  }
  return { delivered: false, channel: null };
}
