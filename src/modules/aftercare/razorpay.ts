import 'server-only';

/**
 * Razorpay payment links for the service visit's charge (owner, 20 Nov 2026).
 * A link works the same on the website and in the Expo app: we create it,
 * the client opens it, pays, and Razorpay redirects back to
 * /api/pay/razorpay/service (signature checked) and also calls our webhook.
 * Either one books the visit; the second does nothing.
 *
 * Keys come from the environment (Vercel), never a file:
 * RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET. Test-mode
 * keys (rzp_test_…) until the owner switches to live ones. Without them,
 * booking a visit says it is not open yet, and nothing is held.
 *
 * Errors are reduced to a status: a response body can echo the client's
 * phone and email.
 */

const API = 'https://api.razorpay.com/v1';
const TIMEOUT_MS = 15_000;

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export function razorpayReady(): boolean {
  return Boolean(env('RAZORPAY_KEY_ID') && env('RAZORPAY_KEY_SECRET'));
}

export const razorpayKeySecret = (): string => env('RAZORPAY_KEY_SECRET');
export const razorpayWebhookSecret = (): string => env('RAZORPAY_WEBHOOK_SECRET');

export interface LinkInput {
  amountPaise: number;
  /** Our ServiceRequest id: comes back as the reference id. */
  referenceId: string;
  description: string;
  customer: { name: string | null; phone: string | null; email: string | null };
  callbackUrl: string;
  expiresAt: Date;
}

export type LinkResult = { ok: true; id: string; url: string } | { ok: false; error: string };

/**
 * A full refund of a visit's charge, when the studio cancels a paid visit
 * (owner, 20 Nov 2026). Razorpay returns the money to how the client paid.
 */
export async function refundPayment(paymentId: string, amountPaise: number): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!razorpayReady()) return { ok: false, error: 'Payments are not switched on, so the refund could not be sent.' };
  const auth = Buffer.from(`${env('RAZORPAY_KEY_ID')}:${env('RAZORPAY_KEY_SECRET')}`).toString('base64');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, speed: 'normal' }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[razorpay] refund refused', res.status);
      return { ok: false, error: 'Razorpay did not take the refund. Nothing was cancelled; try again, or refund it from the Razorpay dashboard first.' };
    }
    const json = (await res.json()) as { id?: unknown };
    return typeof json.id === 'string' ? { ok: true, id: json.id } : { ok: false, error: 'Razorpay did not confirm the refund. Check the Razorpay dashboard.' };
  } catch (error) {
    console.error('[razorpay] refund error', error instanceof Error ? (error.name === 'AbortError' ? 'timeout' : error.name) : 'unknown');
    return { ok: false, error: 'We could not reach Razorpay. Nothing was cancelled; try again in a minute.' };
  } finally {
    clearTimeout(timer);
  }
}

export async function createPaymentLink(input: LinkInput): Promise<LinkResult> {
  if (!razorpayReady()) return { ok: false, error: 'Paying for a visit is not switched on yet.' };
  const auth = Buffer.from(`${env('RAZORPAY_KEY_ID')}:${env('RAZORPAY_KEY_SECRET')}`).toString('base64');
  const customer: Record<string, string> = {};
  if (input.customer.name) customer.name = input.customer.name.slice(0, 60);
  if (input.customer.phone) customer.contact = input.customer.phone;
  if (input.customer.email) customer.email = input.customer.email;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/payment_links`, {
      method: 'POST',
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: 'INR',
        accept_partial: false,
        reference_id: input.referenceId,
        description: input.description.slice(0, 2048),
        expire_by: Math.floor(input.expiresAt.getTime() / 1000),
        customer,
        // Razorpay's own SMS/email would be a message from us; the app shows the link instead.
        notify: { sms: false, email: false },
        reminder_enable: false,
        callback_url: input.callbackUrl,
        callback_method: 'get',
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[razorpay] payment link refused', res.status);
      return { ok: false, error: 'We could not start the payment. Try again in a minute.' };
    }
    const json = (await res.json()) as { id?: unknown; short_url?: unknown };
    if (typeof json.id !== 'string' || typeof json.short_url !== 'string') return { ok: false, error: 'We could not start the payment. Try again in a minute.' };
    return { ok: true, id: json.id, url: json.short_url };
  } catch (error) {
    console.error('[razorpay] payment link error', error instanceof Error ? (error.name === 'AbortError' ? 'timeout' : error.name) : 'unknown');
    return { ok: false, error: 'We could not reach the payment page. Try again in a minute.' };
  } finally {
    clearTimeout(timer);
  }
}
