/**
 * The SMS fallback for studio messages — the seam, with no provider behind it.
 *
 * The owner has not chosen a provider yet (PHASE-1-PLAN "What I need from
 * you" 1). Indian SMS also needs DLT registration of the sender id and each
 * template before a single message goes out, so wiring one is a decision
 * plus a few days of paperwork, not a line of code.
 *
 * When one is chosen: implement `SmsProvider` in a sibling file (plain
 * `fetch`, like `auth/whatsapp.ts`), read its keys from env with a
 * truthiness check, and return it from `smsProvider()` when they are set.
 * Nothing else changes — `sender.ts` already tries it after WhatsApp.
 *
 * Pure, no `server-only`, so the fallback order is testable.
 */

export interface SmsResult {
  delivered: boolean;
  reason?: string;
}

export interface SmsProvider {
  /** For logs and the sender's result. */
  readonly name: string;
  /** Whether it has what it needs to send. A provider that is not configured is skipped. */
  configured(): boolean;
  /** `to` is E.164 (+91…); `text` is the whole message. */
  send(to: string, text: string): Promise<SmsResult>;
}

/** The provider until one is chosen: never configured, never delivers. */
export const NOT_CONFIGURED: SmsProvider = {
  name: 'none',
  configured: () => false,
  send: async () => ({ delivered: false, reason: 'sms_not_configured' }),
};

/** The SMS provider in use. Always `NOT_CONFIGURED` today. */
export function smsProvider(): SmsProvider {
  return NOT_CONFIGURED;
}
