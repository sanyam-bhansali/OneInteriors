import 'server-only';

/**
 * Outbound WhatsApp, via the Meta Cloud API.
 *
 * Same degradation pattern as `email.ts`: with no credentials configured the
 * app still works — the code is printed to the server console so sign-in
 * functions offline and before Meta approves the template. In production a
 * missing provider is a loud failure rather than a silent one, because "the
 * OTP quietly never sent" locks every customer out of their own quotes and
 * looks, from the outside, exactly like a broken product.
 *
 * Called over plain fetch rather than an SDK. One HTTP call does not justify a
 * dependency, and it keeps the provider swappable if SMS has to be added later.
 *
 * ## The template
 *
 * Authentication messages must use a Meta-approved template of category
 * AUTHENTICATION — a free-form message to someone who has not messaged you in
 * the last 24 hours is rejected outright, which is every first-time customer.
 * The template name is configurable so approval delays do not need a deploy.
 *
 * An authentication template takes the code as its single body parameter, and
 * Meta requires the same value again as the button parameter for the
 * one-tap-copy button. Both are sent below.
 */

const GRAPH_VERSION = 'v21.0';

export interface SendResult {
  delivered: boolean;
  reason?: string;
}

function config() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!phoneNumberId || !accessToken) return null;
  return {
    phoneNumberId,
    accessToken,
    template: process.env.WHATSAPP_OTP_TEMPLATE?.trim() || 'one_interiors_otp',
    locale: process.env.WHATSAPP_OTP_LOCALE?.trim() || 'en',
  };
}

export function hasWhatsApp(): boolean {
  return config() !== null;
}

/**
 * Send a sign-in code.
 *
 * `to` must already be E.164. Meta wants it without the leading '+', which is
 * the sort of detail that produces a silent non-delivery if you get it wrong,
 * so it is stripped here rather than at every call site.
 */
export async function sendOtp(to: string, code: string): Promise<SendResult> {
  const cfg = config();

  if (!cfg) {
    if (process.env.NODE_ENV === 'production') {
      // Deliberately does NOT log the code in production. A console line
      // containing a live credential ends up in a log aggregator that far more
      // people can read than should ever see it.
      console.error('[auth] No WhatsApp provider configured — OTP NOT sent to', to);
      return { delivered: false, reason: 'no_provider' };
    }
    console.log(`\n[auth] WhatsApp OTP for ${to}: ${code}\n`);
    return { delivered: false, reason: 'dev_console' };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to.replace(/^\+/, ''),
          type: 'template',
          template: {
            name: cfg.template,
            language: { code: cfg.locale },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: code }] },
              {
                // The one-tap copy button. Meta requires the code repeated
                // here; omitting it fails the whole send rather than just
                // dropping the button.
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: code }],
              },
            ],
          },
        }),
      },
    );

    if (!res.ok) {
      // Read the body for the reason — Meta's errors are specific and useful
      // ("template does not exist", "recipient not in allowed list") and
      // discarding them turns a five-minute fix into an afternoon.
      const detail = await res.text().catch(() => '');
      console.error('[auth] WhatsApp send failed', res.status, detail.slice(0, 500));
      return { delivered: false, reason: `http_${res.status}` };
    }

    return { delivered: true };
  } catch (error) {
    console.error('[auth] WhatsApp send threw', error);
    return { delivered: false, reason: 'network' };
  }
}
