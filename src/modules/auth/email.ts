import 'server-only';
import { isFault, readEmailConfig } from './email-config';

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

/**
 * Enough of an address to debug with, not enough to be personal data.
 *
 * "sanyam@oneinteriors.in" → "sa•••@oneinteriors.in". The domain is what
 * tells you whether a delivery problem is Gmail or a corporate mail server;
 * the local part is the bit that identifies a person.
 */
function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  if (at < 1) return '•••';
  const local = address.slice(0, at);
  const domain = address.slice(at);
  return `${local.slice(0, 2)}•••${domain}`;
}

export interface SendResult {
  delivered: boolean;
  reason?: string;
}

/** The decision lives in a sibling without `server-only` so it can be tested. */
function config() {
  return readEmailConfig(process.env);
}

export async function sendMagicLink(to: string, link: string): Promise<SendResult> {
  const cfg = config();

  if (isFault(cfg)) {
    if (process.env.NODE_ENV === 'production') {
      // Masked. A raw address here lands in Vercel's logs, which have a much
      // wider readership than the database the address is stored in.
      console.error(`[auth] ${cfg.message} — sign-in link NOT sent to`, maskEmail(to));
      return { delivered: false, reason: cfg.reason };
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

  if (isFault(cfg)) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[studio] ${cfg.message} — welcome NOT sent to`, maskEmail(to));
      return { delivered: false, reason: cfg.reason };
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

/**
 * The acknowledgement a studio gets the moment they apply.
 *
 * ## Why this exists
 *
 * Until now, applying produced silence. A studio filled in fifteen fields,
 * saw a green box, and received nothing — no record, no reference, no
 * evidence it had happened at all. Close the tab and there was no proof.
 *
 * Meanwhile `/apply` promised, in as many words:
 *
 *   "You'll hear from us within a week, either way — and if it's a no, we'll
 *    tell you why rather than going quiet."
 *
 * A business deciding whether we are real reads silence as the answer. This
 * is the cheapest possible fix for the most expensive possible impression.
 *
 * ## What it deliberately does not do
 *
 * No "thanks for your interest, we'll be in touch shortly" with no date on
 * it. It says **a week**, because the page said a week, and a promise made on
 * a page has to be repeated in the inbox where it can be held against us.
 */
export async function sendApplicationReceived(
  to: string,
  studio: { contactName: string | null; studioName: string },
): Promise<SendResult> {
  const cfg = config();
  const greeting = studio.contactName ? `Hello ${studio.contactName},` : 'Hello,';

  const text = [
    greeting,
    '',
    `We have your application for ${studio.studioName}. This is just to say it`,
    'arrived — a person reads every one, and that person is not a filter.',
    '',
    'What happens next:',
    '',
    '  · We read it, and usually ring you before deciding. That call is us',
    '    understanding your practice, not testing you.',
    '  · You hear back within a week, either way.',
    '  · If it is a no, we tell you why. Pune is a small market and a studio',
    '    who was turned down deserves to know what for.',
    '',
    'Nothing you sent is published anywhere, and we do not share it.',
    '',
    'If anything changes — a new project finished, a number that was wrong —',
    'just reply to this. A person reads it.',
    '',
    'One Interiors',
  ].join('\n');

  if (isFault(cfg)) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[apply] ${cfg.message} — acknowledgement NOT sent to`, maskEmail(to));
      return { delivered: false, reason: cfg.reason };
    }
    console.log(`\n[apply] Acknowledgement for ${to}\n`);
    return { delivered: false, reason: 'dev_console' };
  }

  return send(cfg, to, `We have your application — ${studio.studioName}`, text, '[apply]');
}

/**
 * The email a studio gets when we say no.
 *
 * ## Why this is not optional
 *
 * `/apply` promises a reason rather than silence, and `rejectApplication`
 * already refuses to run without one — ops must type at least ten characters
 * explaining themselves. That reason was then stored in the database and
 * shown to nobody.
 *
 * So we were collecting the honesty and not delivering it.
 *
 * ## Why the reason goes in verbatim
 *
 * It was written by a person for this studio. Rewriting it into something
 * softer would make it generic, and a generic rejection is the thing we said
 * we would not send. Ops knows it will be read — that is the point of making
 * them type it.
 */
export async function sendApplicationRejected(
  to: string,
  studio: { contactName: string | null; studioName: string },
  reason: string,
): Promise<SendResult> {
  const cfg = config();
  const greeting = studio.contactName ? `Hello ${studio.contactName},` : 'Hello,';

  const text = [
    greeting,
    '',
    `We are not able to add ${studio.studioName} to the roster at the moment.`,
    '',
    'The reason, plainly:',
    '',
    reason.trim(),
    '',
    'We keep the list small, which means saying no to studios who are doing',
    'good work. It is not a judgement on your practice.',
    '',
    'If the reason above is something that changes — a project finished, a',
    'registration completed — write to us and we will look again. We mean',
    'that; it is not a polite ending.',
    '',
    'One Interiors',
  ].join('\n');

  if (isFault(cfg)) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[apply] ${cfg.message} — rejection NOT sent to`, maskEmail(to));
      return { delivered: false, reason: cfg.reason };
    }
    console.log(`\n[apply] Rejection for ${to}: ${reason}\n`);
    return { delivered: false, reason: 'dev_console' };
  }

  return send(cfg, to, `About your application — ${studio.studioName}`, text, '[apply]');
}

/**
 * The one place an email is actually posted.
 *
 * Extracted because there are now four senders and they had begun to differ
 * in small ways — a `.catch()` here, a different slice length there. A retry
 * policy or a provider change should be one edit, not four.
 */
async function send(
  cfg: { apiKey: string; from: string },
  to: string,
  subject: string,
  text: string,
  tag: string,
): Promise<SendResult> {
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: cfg.from, to, subject, text }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`${tag} Resend ${res.status}: ${body.slice(0, 300)}`);
      return { delivered: false, reason: `provider_${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    console.error(`${tag} send failed:`, err instanceof Error ? err.message : err);
    return { delivered: false, reason: 'network' };
  }
}
