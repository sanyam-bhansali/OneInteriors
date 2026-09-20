import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isFault, isSandboxSender, readEmailConfig } from '@/modules/auth/email-config';

/**
 * The bug this file exists for.
 *
 * `EMAIL_FROM` was `One Interiors <onboarding@resend.dev>` while the Resend
 * dashboard showed `oneinteriors.in` verified, DKIM and SPF green. Everything
 * looked right and no email reached anybody, because the shared sandbox
 * sender delivers only to the Resend account owner.
 *
 * It is worth being precise about why no amount of care would have caught it:
 * the one address it DOES deliver to is your own, which is the address you
 * test with. The configuration works exactly until it matters.
 */

const PROD = { NODE_ENV: 'production', RESEND_API_KEY: 're_x', EMAIL_FROM: '' };

describe('reading the sending domain', () => {
  it('reads the domain out of a display-name address', () => {
    expect(isSandboxSender('One Interiors <onboarding@resend.dev>')).toBe(true);
    expect(isSandboxSender('One Interiors <hello@oneinteriors.in>')).toBe(false);
  });

  it('reads a bare address too', () => {
    expect(isSandboxSender('onboarding@resend.dev')).toBe(true);
    expect(isSandboxSender('hello@oneinteriors.in')).toBe(false);
  });

  it('matches the domain, never a substring of the address', () => {
    /**
     * The trap a naive `from.includes('resend.dev')` walks into. Both of
     * these are perfectly good addresses on domains we would control, and
     * refusing to send from them in production would be an outage with a
     * confusing message attached.
     */
    expect(isSandboxSender('hello@resend.dev.oneinteriors.in')).toBe(false);
    expect(isSandboxSender('resend.dev@oneinteriors.in')).toBe(false);
    expect(isSandboxSender('myresend.dev')).toBe(false);
  });

  it('catches a subdomain of the sandbox', () => {
    expect(isSandboxSender('x@mail.resend.dev')).toBe(true);
  });

  it('is not confused by case or padding', () => {
    expect(isSandboxSender('  One Interiors <Onboarding@ReSend.DEV>  ')).toBe(true);
  });
});

describe('what production refuses', () => {
  it('refuses the sandbox sender, and says what to do about it', () => {
    const c = readEmailConfig({ ...PROD, EMAIL_FROM: 'One Interiors <onboarding@resend.dev>' });
    expect(isFault(c)).toBe(true);
    if (!isFault(c)) return;
    expect(c.reason).toBe('sandbox_sender');
    // The message is the whole value of the guard. A log line that says
    // "email failed" sends somebody to the provider's status page; this one
    // names the variable and the fix.
    expect(c.message).toContain('EMAIL_FROM');
    expect(c.message).toContain('verified');
  });

  it('distinguishes "not configured" from "configured wrongly"', () => {
    // Different causes, different fixes. Collapsing them into one reason is
    // how you end up checking Vercel env vars that were set correctly all
    // along.
    const missing = readEmailConfig({ NODE_ENV: 'production' });
    expect(isFault(missing) && missing.reason).toBe('no_provider');
  });

  it('accepts a verified domain', () => {
    const c = readEmailConfig({ ...PROD, EMAIL_FROM: 'One Interiors <hello@oneinteriors.in>' });
    expect(isFault(c)).toBe(false);
    if (isFault(c)) return;
    expect(c.from).toBe('One Interiors <hello@oneinteriors.in>');
  });

  it('treats whitespace-only values as absent', () => {
    expect(isFault(readEmailConfig({ RESEND_API_KEY: '  ', EMAIL_FROM: 'a@b.in' }))).toBe(true);
    expect(isFault(readEmailConfig({ RESEND_API_KEY: 're_x', EMAIL_FROM: '   ' }))).toBe(true);
  });
});

describe('what development still allows', () => {
  it('permits the sandbox sender outside production', () => {
    /**
     * Deliberate asymmetry. Before any domain is verified, sending through
     * the sandbox to your own address is the only way to see a real email
     * rather than a console line — refusing it in development would remove
     * the thing that makes the sandbox useful at all.
     */
    const c = readEmailConfig({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'onboarding@resend.dev' });
    expect(isFault(c)).toBe(false);
  });
});

describe('the checked-in example does not teach the mistake', () => {
  it('.env.example does not suggest a sandbox sender as the value', () => {
    /**
     * The example file is where the next person copies from. If it carried
     * `onboarding@resend.dev` as the value, the guard above would be a
     * tripwire on a path we had pointed them down ourselves.
     */
    const example = readFileSync(join(__dirname, '..', '.env.example'), 'utf8');
    const assignment = example
      .split('\n')
      .filter((l) => /^\s*EMAIL_FROM\s*=/.test(l))
      .join('\n');

    expect(assignment, 'EMAIL_FROM must be documented in .env.example').not.toBe('');
    expect(isSandboxSender(assignment)).toBe(false);
  });
});
