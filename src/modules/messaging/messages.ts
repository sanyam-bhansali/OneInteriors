/**
 * What the studio side sends to a person's phone, and the words for each
 * channel. Pure (CONTRIBUTING §9.5): `sender.ts` decides the channel, this
 * decides what it says, and tests/studio-messaging.test.ts reads both.
 *
 * Studio staff only. Customers' sign-in codes stay on `auth/whatsapp.ts`
 * `sendOtp`, unchanged (owner, 11 Oct 2026: customers are app and email,
 * studio staff WhatsApp with SMS as the fallback).
 */

export type StudioMessage =
  /** A six-digit sign-in code for /studio/sign-in. */
  | { kind: 'code'; code: string }
  /** "You have been added to {studio}": the sign-in link, from Settings → Team. */
  | { kind: 'invite'; name: string; studioName: string; link: string };

/**
 * Env var for each kind's approved WhatsApp template. Unset means "not
 * approved yet": WhatsApp is skipped and the next channel is tried.
 *
 * The code template must be category AUTHENTICATION (body = the code, plus
 * the copy-code button), like the customer's. The invite template is
 * UTILITY with three body parameters in order: name, studio, link.
 */
export const TEMPLATE_ENV: Record<StudioMessage['kind'], string> = {
  code: 'WHATSAPP_STUDIO_CODE_TEMPLATE',
  invite: 'WHATSAPP_STUDIO_INVITE_TEMPLATE',
};

/** The template's body parameters, in order. */
export function templateParams(message: StudioMessage): string[] {
  return message.kind === 'code' ? [message.code] : [message.name, message.studioName, message.link];
}

/**
 * The plain-text version, for SMS and the development console. Short: one
 * SMS segment for the code, and nothing a carrier's filter reads as spam.
 */
export function plainText(message: StudioMessage): string {
  if (message.kind === 'code') {
    return `${message.code} is your One Interiors Studio sign-in code. It expires in 10 minutes. Do not share it.`;
  }
  return `${message.name}, ${message.studioName} has added you on One Interiors Studio. Sign in with this number: ${message.link}`;
}

/** Last four digits only — a whole number in a log line is personal data with a wide readership. */
export function maskPhone(to: string): string {
  return `•••••${to.slice(-4)}`;
}
