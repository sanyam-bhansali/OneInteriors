import 'server-only';

/**
 * MessageSender: one way to reach a studio team member's phone.
 *
 * In order, stopping at the first that delivers:
 *
 *  1. **WhatsApp**, when the approved studio template for this kind of
 *     message is named in env (`TEMPLATE_ENV`) and WhatsApp is configured.
 *  2. **SMS**, when a provider is configured (`sms.ts` — none is today; the
 *     owner has not chosen one).
 *  3. **The server console**, in local development only, so sign-in and
 *     invites can be tried with no provider at all. Never in production: a
 *     log line holding a live sign-in code ends up in a log aggregator far
 *     more people can read than should ever see it.
 *
 * `delivered: false` is an answer, not an error. The caller decides what it
 * means: the studio sign-in shows the code on screen in local development
 * only, and Settings → Team says the invite could not be sent.
 *
 * Customers' codes do not come through here: `auth/otp.ts` still calls
 * `auth/whatsapp.ts` `sendOtp` for them, exactly as before.
 */

import { hasWhatsApp, sendOtp, sendTemplate } from '@/modules/auth/whatsapp';
import { isProduction } from '@/lib/env';
import { TEMPLATE_ENV, maskPhone, plainText, templateParams, type StudioMessage } from './messages';
import { smsProvider, type SmsProvider } from './sms';

export type { StudioMessage } from './messages';

export interface SendOutcome {
  delivered: boolean;
  via: 'whatsapp' | 'sms' | 'console' | 'none';
  /** Why the last channel tried did not deliver, for the server log. */
  reason?: string;
}

function templateFor(kind: StudioMessage['kind']): string | null {
  return process.env[TEMPLATE_ENV[kind]]?.trim() || null;
}

export async function send(to: string, message: StudioMessage, sms: SmsProvider = smsProvider()): Promise<SendOutcome> {
  let reason: string | undefined;

  const template = templateFor(message.kind);
  if (template && hasWhatsApp()) {
    const r =
      message.kind === 'code'
        ? await sendOtp(to, message.code, { template })
        : await sendTemplate(to, template, templateParams(message));
    if (r.delivered) return { delivered: true, via: 'whatsapp' };
    reason = r.reason;
  }

  if (sms.configured()) {
    const r = await sms.send(to, plainText(message));
    if (r.delivered) return { delivered: true, via: 'sms' };
    reason = r.reason;
  }

  if (!isProduction()) {
    console.log(`\n[messaging] ${message.kind} for ${to}: ${plainText(message)}\n`);
    return { delivered: false, via: 'console', reason: reason ?? 'dev_console' };
  }

  console.error('[messaging] no channel delivered the studio', message.kind, 'to', maskPhone(to), reason ?? 'no_provider');
  return { delivered: false, via: 'none', reason: reason ?? 'no_provider' };
}
