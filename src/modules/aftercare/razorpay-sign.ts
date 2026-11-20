/**
 * Razorpay's signatures, checked (owner, 20 Nov 2026: the visiting charge is
 * paid online through Razorpay). Pure apart from node:crypto, and tested.
 *
 * - The payment link's redirect back to us carries
 *   `razorpay_signature` = HMAC-SHA256 of
 *   `link_id|reference_id|status|payment_id` with the key secret.
 * - The webhook carries `X-Razorpay-Signature` = HMAC-SHA256 of the raw body
 *   with the webhook secret.
 *
 * Compared in constant time. Never trust a redirect's "paid" without this.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');

function same(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface LinkCallback {
  paymentId: string;
  linkId: string;
  referenceId: string;
  status: string;
  signature: string;
}

/** The query Razorpay redirects back with, read; null when anything is missing. */
export function readLinkCallback(q: URLSearchParams): LinkCallback | null {
  const get = (k: string) => (q.get(k) ?? '').trim().slice(0, 128);
  const v = {
    paymentId: get('razorpay_payment_id'),
    linkId: get('razorpay_payment_link_id'),
    referenceId: get('razorpay_payment_link_reference_id'),
    status: get('razorpay_payment_link_status'),
    signature: get('razorpay_signature'),
  };
  return v.paymentId && v.linkId && v.status && v.signature ? v : null;
}

export function linkCallbackValid(c: LinkCallback, keySecret: string): boolean {
  if (!keySecret) return false;
  return same(hmac(keySecret, `${c.linkId}|${c.referenceId}|${c.status}|${c.paymentId}`), c.signature);
}

export function webhookValid(rawBody: string, signature: string | null, webhookSecret: string): boolean {
  if (!webhookSecret || !signature) return false;
  return same(hmac(webhookSecret, rawBody), signature.trim());
}

/** From a `payment_link.paid` webhook body: the link and the payment. Null for any other event. */
export function paidFromWebhook(body: unknown): { linkId: string; paymentId: string; amountPaise: number } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { event?: unknown; payload?: { payment_link?: { entity?: { id?: unknown } }; payment?: { entity?: { id?: unknown; amount?: unknown } } } };
  if (b.event !== 'payment_link.paid') return null;
  const linkId = b.payload?.payment_link?.entity?.id;
  const paymentId = b.payload?.payment?.entity?.id;
  const amount = b.payload?.payment?.entity?.amount;
  if (typeof linkId !== 'string' || typeof paymentId !== 'string') return null;
  return { linkId, paymentId, amountPaise: typeof amount === 'number' ? amount : 0 };
}
