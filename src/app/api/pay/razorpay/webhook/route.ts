import { markServicePaid } from '@/modules/aftercare/store';
import { razorpayWebhookSecret } from '@/modules/aftercare/razorpay';
import { paidFromWebhook, webhookValid } from '@/modules/aftercare/razorpay-sign';

/**
 * POST /api/pay/razorpay/webhook — Razorpay's `payment_link.paid` event, the
 * backstop for a client who closes the page before the redirect. Signed with
 * RAZORPAY_WEBHOOK_SECRET (set the same secret in Razorpay's dashboard).
 * Booking twice does nothing the second time.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 64 * 1024;

export async function POST(req: Request) {
  const raw = await req.text().catch(() => '');
  if (!raw || raw.length > MAX_BODY) return new Response('bad request', { status: 400 });
  if (!webhookValid(raw, req.headers.get('x-razorpay-signature'), razorpayWebhookSecret())) return new Response('bad signature', { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad request', { status: 400 });
  }
  const paid = paidFromWebhook(body);
  if (!paid) return new Response('ignored', { status: 200 });
  await markServicePaid(paid.linkId, paid.paymentId);
  // 200 even for a link we do not know: Razorpay would only retry it.
  return new Response('ok', { status: 200 });
}
