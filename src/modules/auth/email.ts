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
