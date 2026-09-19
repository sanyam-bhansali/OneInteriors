import 'server-only';

/**
 * Outbound email.
 *
 * Graceful degradation, same pattern as the database: with no provider
 * configured the app still works — the link is logged to the server console and
 * returned to the dev UI, so sign-in functions offline and before Resend is
 * set up. In production a missing provider is a hard failure rather than a
 * silent one, because "the email quietly never sent" is the worst outcome.
 *
 * Resend is called over plain fetch rather than the SDK: one HTTP call does not
 * justify a dependency, and it keeps the provider swappable.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface SendResult {
  delivered: boolean;
  reason?: string;
}

function config() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export async function sendMagicLink(to: string, link: string): Promise<SendResult> {
  const cfg = config();

  if (!cfg) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[auth] No email provider configured — sign-in link NOT sent to', to);
      return { delivered: false, reason: 'no_provider' };
    }
    // Development: print it. Deliberately the whole link, so it is one click.
    console.log(`\n[auth] Sign-in link for ${to}:\n  ${link}\n`);
    return { delivered: false, reason: 'dev_console' };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: cfg.from,
        to,
        subject: 'Your One Interiors sign-in link',
        text: [
          'Sign in to One Interiors:',
          '',
          link,
          '',
          'This link works once and expires in 15 minutes.',
          "If you didn't ask for it, you can ignore this email — nobody can sign in without it.",
        ].join('\n'),
      }),
    });

    if (!res.ok) {
      // Surface the provider's own error. PROJECT_LEARNINGS §3: this turns
      // hours of guessing into a one-line fix.
      const body = await res.text().catch(() => '');
      console.error(`[auth] Resend ${res.status}: ${body.slice(0, 300)}`);
      return { delivered: false, reason: `provider_${res.status}` };
    }

    return { delivered: true };
  } catch (err) {
    console.error('[auth] Email send failed:', err instanceof Error ? err.message : err);
    return { delivered: false, reason: 'network' };
  }
}

/**
 * The email a studio gets the moment they are approved.
 *
 * ## Why this is not the sign-in email
 *
 * Approval used to send the plain "Your One Interiors sign-in link", which
 * meant an owner who had applied three weeks earlier received an unexplained
 * link with no subject line telling them anything had happened — and it
 * expired in fifteen minutes, so reading it after a site visit meant clicking
 * a dead link as their first experience of us.
 *
 * So: what happened, what is being asked of them, roughly how long it takes,
 * and what we do afterwards. The five steps are listed because "complete your
 * profile" is a request of unknown size, and an unknown size is what people
 * put off.
 *
 * ## Plain text, deliberately
 *
 * No HTML, no logo, no tracking pixel. This goes to somebody who runs a
 * workshop and reads it on a phone between site visits, and a plain message
 * from a person is both more likely to be read and more likely to land in the
 * inbox rather than the promotions tab. It is also the format that cannot
 * break in an email client we have not tested.
 */
export async function sendStudioWelcome(
  to: string,
  link: string,
  studio: { contactName: string | null; studioName: string },
): Promise<SendResult> {
  const cfg = config();
  const greeting = studio.contactName ? `Hello ${studio.contactName},` : 'Hello,';

  const text = [
    greeting,
    '',
    `${studio.studioName} has been approved for the One Interiors roster.`,
    '',
    'There are five things only you can do. About forty minutes in total, and',
    'it saves as you go, so you can stop and come back.',
    '',
    '  1. How you describe yourselves, and where you work',
    '  2. Your registration numbers',
    '  3. Three completed projects — this is what customers actually read',
    '  4. Your rates. Private, and never shown to anyone but you',
    '  5. Send it to us',
    '',
    'Start here:',
    link,
    '',
    'That link is good for seven days and signs you straight in.',
    '',
    'After you send it: we check your registration against the public records,',
    'ring two of your past clients, and visit two finished sites. Then you see',
    'the profile and approve every word of it before it goes live.',
    '',
    'Reply to this email if anything is unclear. A person reads it.',
    '',
    'One Interiors',
  ].join('\n');

  if (!cfg) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[studio] No email provider configured — welcome NOT sent to', to);
      return { delivered: false, reason: 'no_provider' };
    }
    console.log(`\n[studio] Welcome for ${to}:\n  ${link}\n`);
    return { delivered: false, reason: 'dev_console' };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: cfg.from,
        to,
        // Says what happened. A subject line that only says "sign in" makes
        // the most important email we ever send look like a password reset.
        subject: `${studio.studioName} is on the One Interiors roster`,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[studio] Resend ${res.status}: ${body.slice(0, 300)}`);
      return { delivered: false, reason: `provider_${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    console.error('[studio] Welcome send failed:', err instanceof Error ? err.message : err);
    return { delivered: false, reason: 'network' };
  }
}
