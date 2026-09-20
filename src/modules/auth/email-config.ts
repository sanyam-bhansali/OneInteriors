/**
 * Reading the email configuration, and refusing the one that lies.
 *
 * No `server-only` here, deliberately — CONTRIBUTING §9.5. The decision this
 * file makes is pure, and it is the decision that was wrong in production, so
 * it needs to be reachable from a test.
 *
 * ## What went wrong, so it is not rediscovered
 *
 * `EMAIL_FROM` was `One Interiors <onboarding@resend.dev>`. Resend's domain
 * verification was green, so everything looked configured, and nothing
 * arrived.
 *
 * `resend.dev` is Resend's **shared sandbox sender**. It delivers only to the
 * address that owns the Resend account and returns 403 for every other
 * recipient. Verifying your own domain does not change that by itself — the
 * From address has to actually use the verified domain.
 *
 * That combination is the worst kind of misconfiguration, because of the
 * order in which people meet it:
 *
 *   1. You test locally, with your own address. It arrives.
 *   2. You ship.
 *   3. It fails for every real person, and for nobody before them.
 *
 * There is no stage of ordinary testing that catches it. So it is caught
 * here instead.
 */

export interface EmailConfig {
  apiKey: string;
  from: string;
}

export interface EmailConfigFault {
  reason: 'no_provider' | 'sandbox_sender';
  message: string;
}

/**
 * Sending domains that look configured and are not.
 *
 * Kept as a list because every provider has one of these — Postmark,
 * Mailgun and SendGrid all ship a shared sandbox sender with the same
 * recipient restriction. When the provider changes, add theirs.
 */
export const SANDBOX_SENDER_DOMAINS = ['resend.dev'] as const;

export interface EmailEnv {
  RESEND_API_KEY?: string | undefined;
  EMAIL_FROM?: string | undefined;
  NODE_ENV?: string | undefined;
}

export function isFault(c: EmailConfig | EmailConfigFault): c is EmailConfigFault {
  return 'reason' in c;
}

/**
 * Is this address one of the shared sandbox senders?
 *
 * Matched on the domain after the last `@`, not anywhere in the string. A
 * naive `includes` would fire on a perfectly good
 * `hello@resend.dev.oneinteriors.in`, and — much worse — would MISS nothing
 * while teaching whoever reads it that substring matching is good enough for
 * addresses, which is how the host-matching bug in src/lib/host.ts would have
 * happened if it had been written the same way.
 */
export function isSandboxSender(from: string): boolean {
  // "One Interiors <hello@example.com>" → "example.com"
  const inAngles = /<([^>]*)>/.exec(from);
  const address = (inAngles?.[1] ?? from).trim().toLowerCase();
  const at = address.lastIndexOf('@');
  if (at < 0) return false;
  const domain = address.slice(at + 1);
  return SANDBOX_SENDER_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function readEmailConfig(env: EmailEnv): EmailConfig | EmailConfigFault {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return { reason: 'no_provider', message: 'No email provider configured' };
  }

  /* Production only. In development, sending through the sandbox to your own
     address genuinely works and is genuinely useful — refusing it there would
     remove the one way to see a real email before any domain is set up. The
     asymmetry is the point: help in development, refuse in production. */
  if (env.NODE_ENV === 'production' && isSandboxSender(from)) {
    return {
      reason: 'sandbox_sender',
      message:
        `EMAIL_FROM is a sandbox sender (${from}), which the provider delivers ` +
        'only to the account owner. Set EMAIL_FROM to an address on a domain ' +
        'verified with the provider',
    };
  }

  return { apiKey, from };
}
