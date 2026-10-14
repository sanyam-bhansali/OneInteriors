/**
 * Sending a studio's own client the invite to the app
 * (docs/studio-workspace/OWN-CLIENTS.md). Customers never get WhatsApp
 * (owner, 11 Oct 2026): this goes by SMS when a provider is configured and
 * by email when the client record has an address — and the studio always
 * gets the link and the words to send itself, so an invite never depends on
 * either.
 *
 * Deliberately NOT `messaging/sender.ts` `send`, which tries WhatsApp first
 * and is for studio staff. This file imports nothing that can reach
 * WhatsApp (tests/own-project.test.ts checks). Pure: the channels are
 * passed in.
 */

import type { SmsProvider } from '@/modules/messaging/sms';

export type InviteChannel = 'sms' | 'email';

export interface InviteDelivery {
  phone: string;
  email: string | null;
  /** The SMS: the invite in the customer's language. */
  text: string;
  emailNotice: { title: string; body: string; url: string };
}

export interface InviteChannels {
  sms: SmsProvider;
  /** `auth/email.ts` `sendNotice` in the server; null when email is not to be tried. */
  sendEmail: ((to: string, notice: { title: string; body: string; url: string }) => Promise<{ delivered: boolean }>) | null;
}

/** The channels that took the invite. Empty: nothing went out, and the studio shares the link (the page says so). Never throws. */
export async function deliverInvite(d: InviteDelivery, channels: InviteChannels): Promise<InviteChannel[]> {
  const via: InviteChannel[] = [];
  if (channels.sms.configured()) {
    const r = await channels.sms.send(d.phone, d.text).catch(() => ({ delivered: false }));
    if (r.delivered) via.push('sms');
  }
  if (d.email && channels.sendEmail) {
    const r = await channels.sendEmail(d.email, d.emailNotice).catch(() => ({ delivered: false }));
    if (r.delivered) via.push('email');
  }
  return via;
}
